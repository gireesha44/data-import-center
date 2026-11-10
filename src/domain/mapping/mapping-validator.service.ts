/**
 * Column Mapping Validator Service
 */

import { EntitySchemaDefinition } from '../../core/registry/entity-schema.registry.js';
import {
  ColumnMapping,
  MappingIssue,
  MappingValidationResult,
  SourceColumn
} from '../../core/types/mapping.types.js';
import { TypeCompatibilityEvaluator } from './type-compatibility.evaluator.js';

export class MappingValidatorService {
  /**
   * Validates a column mapping configuration against an entity schema and source columns
   */
  public static validate(
    mappings: Record<string, ColumnMapping>,
    schema: EntitySchemaDefinition,
    sourceColumns: SourceColumn[]
  ): MappingValidationResult {
    const issues: MappingIssue[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    const sourceColumnMap = new Map<string, SourceColumn>();
    for (const col of sourceColumns) {
      sourceColumnMap.set(col.originalName, col);
    }

    const targetFieldMap = new Map(Object.entries(schema.fields));
    const requiredFields = Object.values(schema.fields)
      .filter((f) => f.required && !f.readOnly)
      .map((f) => f.name);

    const mappedTargetFields = new Set<string>();
    const mappedSourceColumns: string[] = [];
    const targetAssignmentCount = new Map<string, string[]>();

    const incompatibleMappings: string[] = [];
    const ambiguousMappings: string[] = [];

    // 1. Validate each specified mapping
    for (const [sourceName, mapping] of Object.entries(mappings)) {
      if (!mapping.enabled) {
        continue;
      }

      mappedSourceColumns.push(sourceName);

      // Check 1: Does source column exist?
      const sourceCol = sourceColumnMap.get(sourceName);
      if (!sourceCol) {
        const msg = `Source column '${sourceName}' does not exist in uploaded dataset`;
        errors.push(msg);
        issues.push({
          code: 'UNKNOWN_SOURCE_COLUMN',
          message: msg,
          severity: 'ERROR',
          sourceColumn: sourceName
        });
      }

      // Check 2: Does target field exist in entity schema?
      const targetFieldDef = targetFieldMap.get(mapping.targetField);
      if (!targetFieldDef) {
        const msg = `Target field '${mapping.targetField}' is not defined on entity '${schema.entity}'`;
        errors.push(msg);
        issues.push({
          code: 'UNKNOWN_TARGET_FIELD',
          message: msg,
          severity: 'ERROR',
          sourceColumn: sourceName,
          targetField: mapping.targetField
        });
        continue;
      }

      // Check 3: Is target field read-only?
      if (targetFieldDef.readOnly) {
        const msg = `Target field '${mapping.targetField}' is read-only and cannot be imported`;
        errors.push(msg);
        issues.push({
          code: 'READ_ONLY_FIELD_MAPPED',
          message: msg,
          severity: 'ERROR',
          sourceColumn: sourceName,
          targetField: mapping.targetField
        });
      }

      // Track target assignments for duplicate detection
      const existingAssignments = targetAssignmentCount.get(mapping.targetField) || [];
      existingAssignments.push(sourceName);
      targetAssignmentCount.set(mapping.targetField, existingAssignments);
      mappedTargetFields.add(mapping.targetField);

      // Check 4: Type compatibility
      if (sourceCol) {
        const compatibility = TypeCompatibilityEvaluator.evaluate(
          sourceCol.inferredType,
          targetFieldDef.type
        );
        mapping.compatibility = compatibility;

        if (compatibility === 'INCOMPATIBLE') {
          const msg = `Source column '${sourceName}' (inferred ${sourceCol.inferredType}) is incompatible with target '${mapping.targetField}' (${targetFieldDef.type})`;
          incompatibleMappings.push(sourceName);
          errors.push(msg);
          issues.push({
            code: 'TYPE_INCOMPATIBLE',
            message: msg,
            severity: 'ERROR',
            sourceColumn: sourceName,
            targetField: mapping.targetField
          });
        } else if (compatibility === 'TRANSFORM_REQUIRED') {
          const msg = `Source column '${sourceName}' (${sourceCol.inferredType}) will require transformation/parsing to match '${mapping.targetField}' (${targetFieldDef.type})`;
          warnings.push(msg);
          issues.push({
            code: 'TRANSFORMATION_REQUIRED',
            message: msg,
            severity: 'WARNING',
            sourceColumn: sourceName,
            targetField: mapping.targetField
          });
        }
      }
    }

    // Check 5: Duplicate target assignments
    for (const [targetField, assignedSources] of targetAssignmentCount.entries()) {
      if (assignedSources.length > 1) {
        const msg = `Target field '${targetField}' is assigned multiple times by source columns: ${assignedSources.join(', ')}`;
        errors.push(msg);
        issues.push({
          code: 'DUPLICATE_TARGET_MAPPING',
          message: msg,
          severity: 'ERROR',
          targetField
        });
      }
    }

    // Check 6: Required fields check
    const mappedRequiredFields: string[] = [];
    const unmappedRequiredFields: string[] = [];

    for (const reqField of requiredFields) {
      if (mappedTargetFields.has(reqField)) {
        mappedRequiredFields.push(reqField);
      } else {
        unmappedRequiredFields.push(reqField);
        const fieldDef = targetFieldMap.get(reqField);
        const label = fieldDef?.label || reqField;
        const msg = `Required target field '${label}' (${reqField}) is not mapped`;
        errors.push(msg);
        issues.push({
          code: 'REQUIRED_FIELD_UNMAPPED',
          message: msg,
          severity: 'ERROR',
          targetField: reqField
        });
      }
    }

    // Unmapped source columns
    const unmappedSourceColumns = sourceColumns
      .map((c) => c.originalName)
      .filter((name) => !mappedSourceColumns.includes(name));

    const isValid = errors.length === 0;

    return {
      isValid,
      entity: schema.entity,
      mappings,
      mappedSourceColumns,
      unmappedSourceColumns,
      mappedRequiredFields,
      unmappedRequiredFields,
      incompatibleMappings,
      ambiguousMappings,
      issues,
      warnings,
      errors
    };
  }
}
