/**
 * Deterministic Transformation Pipeline
 * Sequentially executes transformations per column with bound enforcement
 */

import {
  ColumnTransformationConfig,
  TransformContext,
  TransformedValueResult,
  TransformationAuditEntry
} from '../../core/types/transformation.types.js';
import { ITransformationRegistry, transformationRegistry } from './transformation.registry.js';
import { EntitySchemaDefinition } from '../../core/registry/entity-schema.registry.js';
import { DataImportMappingEntity } from '../entities/data-import-mapping.entity.js';
import { ValidationError } from '../../core/errors/import.errors.js';


export interface TransformedRowResult {
  rowIndex: number;
  rawData: Record<string, unknown>;
  transformedData: Record<string, unknown>;
  transformationErrors: Record<string, string>;
  transformationAudit: Record<string, TransformationAuditEntry[]>;
}

export class TransformationPipeline {
  private readonly MAX_TRANSFORM_CHAIN_LENGTH = 10;

  constructor(
    private readonly registry: ITransformationRegistry = transformationRegistry
  ) {}

  /**
   * Transforms an individual cell value through a chain of configured transformations
   */
  public transformValue(
    value: unknown,
    transforms: { type: string; options?: Record<string, unknown> }[],
    context: TransformContext
  ): TransformedValueResult {
    let current = value;
    const appliedTransforms: string[] = [];

    if (transforms.length > this.MAX_TRANSFORM_CHAIN_LENGTH) {
      throw new ValidationError(
        `Transformation chain limit exceeded (${transforms.length} > ${this.MAX_TRANSFORM_CHAIN_LENGTH})`
      );
    }

    try {
      for (const t of transforms) {
        const transformer = this.registry.getTransformer(t.type);
        if (!transformer) {
          throw new ValidationError(`Unknown transformation '${t.type}'`);
        }

        current = transformer.execute(current, t.options, context);
        appliedTransforms.push(transformer.name);
      }

      return {
        originalValue: value,
        transformedValue: current,
        appliedTransforms
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        originalValue: value,
        transformedValue: current,
        appliedTransforms,
        error: msg
      };
    }
  }

  /**
   * Transforms a full source row using the import mapping and target entity schema
   */
  public transformRow(
    rowIndex: number,
    rawRow: Record<string, unknown>,
    mapping: DataImportMappingEntity,
    schema: EntitySchemaDefinition,
    contextInfo: { organizationId: string; importId: string }
  ): TransformedRowResult {
    const transformedData: Record<string, unknown> = {};
    const transformationErrors: Record<string, string> = {};
    const transformationAudit: Record<string, TransformationAuditEntry[]> = {};

    const columnMappings = mapping.columnMappings || {};

    for (const [sourceHeader, mapDef] of Object.entries(columnMappings)) {
      const targetField = mapDef.targetField;
      const targetFieldDef = schema.fields[targetField];
      if (!targetFieldDef) continue;

      let rawVal = rawRow[sourceHeader];
      if (rawVal === undefined) {
        const normalizedKey = sourceHeader.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        for (const [k, v] of Object.entries(rawRow)) {
          const kNorm = k.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
          if (k === sourceHeader || k.toLowerCase() === sourceHeader.toLowerCase() || kNorm === normalizedKey) {
            rawVal = v;
            break;
          }
        }
      }

      // Assemble transformation chain
      const transforms: { type: string; options?: Record<string, unknown> }[] = [];

      // 1. Initial Null Normalization & Trim
      transforms.push({ type: 'NULL_NORMALIZE' });
      transforms.push({ type: 'TRIM' });

      // 2. Custom transformations if any
      const customTransforms = (mapping.transformations && mapping.transformations[sourceHeader]) || [];
      for (const ct of customTransforms) {
        if (typeof ct === 'string') transforms.push({ type: ct });
        else if (typeof ct === 'object' && ct !== null && 'type' in ct) transforms.push(ct as any);
      }

      // 3. Schema-driven Type Conversions
      switch (targetFieldDef.type) {
        case 'EMAIL':
          transforms.push({ type: 'LOWERCASE' });
          break;
        case 'NUMBER':
          transforms.push({ type: 'TO_NUMBER' });
          break;
        case 'DECIMAL':
          transforms.push({ type: 'TO_DECIMAL', options: { precision: targetFieldDef.constraints?.max } });
          break;
        case 'BOOLEAN':
          transforms.push({ type: 'TO_BOOLEAN' });
          break;
        case 'DATE':
          transforms.push({ type: 'TO_DATE' });
          break;
        case 'DATETIME':
          transforms.push({ type: 'TO_DATETIME' });
          break;
        case 'PHONE':
          transforms.push({ type: 'PHONE_FORMAT' });
          break;
        case 'ENUM':
          if (targetFieldDef.enumValues && targetFieldDef.enumValues.length > 0) {
            transforms.push({ type: 'NORMALIZE_ENUM', options: { enumValues: targetFieldDef.enumValues, enumAliases: targetFieldDef.enumAliases } });
          }
          break;
        case 'STRING':
          transforms.push({ type: 'TO_STRING' });
          break;
      }

      // 4. Default Value fallback if value is null
      if (mapDef.defaultValue !== undefined || targetFieldDef.defaultValue !== undefined) {
        const fallback = mapDef.defaultValue !== undefined ? mapDef.defaultValue : targetFieldDef.defaultValue;
        transforms.push({ type: 'DEFAULT_VALUE', options: { defaultValue: fallback } });
      }

      const context: TransformContext = {
        organizationId: contextInfo.organizationId,
        importId: contextInfo.importId,
        targetEntity: schema.entity,
        targetField,
        sourceColumn: sourceHeader,
        rowIndex,
        rowRawData: rawRow
      };

      const result = this.transformValue(rawVal, transforms, context);

      const confidenceByType: Record<string, number> = {
        NULL_NORMALIZE: 0.99,
        TRIM: 0.99,
        LOWERCASE: 0.98,
        UPPERCASE: 0.98,
        NORMALIZE_ENUM: 0.97,
        PHONE_FORMAT: 0.96,
        TO_NUMBER: 0.96,
        TO_DECIMAL: 0.96,
        TO_DATE: 0.95,
        TO_DATETIME: 0.95,
        TO_BOOLEAN: 0.95,
        TO_STRING: 0.99,
        DEFAULT_VALUE: 0.90
      };
      transformationAudit[targetField] = result.appliedTransforms.map((type) => ({
        type,
        confidence: confidenceByType[type] ?? 0.85,
        explanation: this.explainTransformation(type, rawVal, result.transformedValue)
      }));

      if (result.error) {
        transformationErrors[targetField] = result.error;
        transformedData[targetField] = rawVal; // Preserve raw value for inspection
      } else {
        transformedData[targetField] = result.transformedValue;
      }
    }

    return {
      rowIndex,
      rawData: rawRow,
      transformedData,
      transformationErrors,
      transformationAudit
    };
  }

  private explainTransformation(type: string, originalValue: unknown, transformedValue: unknown): string {
    const changed = String(originalValue ?? '') !== String(transformedValue ?? '');
    const descriptions: Record<string, string> = {
      NULL_NORMALIZE: 'Normalized blank/null markers before validation.',
      TRIM: 'Removed leading and trailing whitespace.',
      LOWERCASE: 'Normalized text casing to lowercase.',
      UPPERCASE: 'Normalized text casing to uppercase.',
      NORMALIZE_ENUM: 'Mapped the value to the configured canonical enum value when the match was deterministic.',
      PHONE_FORMAT: 'Normalized phone punctuation and country-code formatting according to configured rules.',
      TO_NUMBER: 'Parsed the value as an integer after removing safe numeric separators.',
      TO_DECIMAL: 'Parsed the value as a decimal after removing safe numeric separators.',
      TO_DATE: 'Normalized an unambiguous date to YYYY-MM-DD.',
      TO_DATETIME: 'Normalized an unambiguous datetime to ISO 8601.',
      TO_BOOLEAN: 'Normalized an approved boolean representation.',
      TO_STRING: 'Converted the value to the target string representation.',
      DEFAULT_VALUE: 'Applied the configured default only because the source value was empty.'
    };
    return `${descriptions[type] || 'Applied a schema-configured transformation.'}${changed ? ' Value changed.' : ' No value change was required.'}`;
  }
}

export const transformationPipeline = new TransformationPipeline();
