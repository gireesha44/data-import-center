/**
 * Multi-Tier Validation Engine
 * Coordinates Field (Tier 2), Cross-Field (Tier 3), and Business Rule (Tier 4) validation
 */

import { EntitySchemaDefinition } from '../../core/registry/entity-schema.registry.js';
import {
  FieldValidationIssue,
  IFieldValidator,
  ICrossFieldValidator,
  RowValidationResult,
  ValidationContext,
  ValidationSummary
} from '../../core/types/validation.types.js';
import { RecordStatus } from '../../core/types/import.types.js';
import {
  RequiredValidator,
  OptionalFieldValidator,
  DataTypeValidator,
  EnumValidator,
  EmailValidator,
  PhoneValidator,
  StringConstraintValidator,
  NumericRangeValidator
} from './field-validators.js';
import { DateRangeCrossFieldValidator } from './cross-field.validators.js';
import { EntityValidatorRegistry, entityValidatorRegistry } from './entity-validator.registry.js';
import { TransformationPipeline, transformationPipeline } from '../transformation/transformation.pipeline.js';
import { DataImportMappingEntity } from '../entities/data-import-mapping.entity.js';

export class ValidationEngine {
  private fieldValidators: IFieldValidator[] = [
    new RequiredValidator(),
    new DataTypeValidator(),
    new EnumValidator(),
    new EmailValidator(),
    new PhoneValidator(),
    new StringConstraintValidator(),
    new NumericRangeValidator()
  ];

  private crossFieldValidators: ICrossFieldValidator[] = [
    new DateRangeCrossFieldValidator()
  ];

  constructor(
    private readonly entityValidators: EntityValidatorRegistry = entityValidatorRegistry,
    private readonly pipeline: TransformationPipeline = transformationPipeline
  ) {}

  /**
   * Validates a single transformed row against all validation tiers
   */
  public validateRow(
    rowIndex: number,
    rawData: Record<string, unknown>,
    transformedData: Record<string, unknown>,
    transformationErrors: Record<string, string>,
    schema: EntitySchemaDefinition,
    contextInfo: { organizationId: string; importId: string }
  ): RowValidationResult {
    const issues: FieldValidationIssue[] = [];

    const context: ValidationContext = {
      organizationId: contextInfo.organizationId,
      importId: contextInfo.importId,
      targetEntity: schema.entity,
      rowIndex,
      rawData,
      transformedData,
      schema
    };

    // 0. Include transformation failures as the primary actionable error for
    // that cell. Do not add a second generic type error for the same failed
    // transformation; one invalid cell should produce one correction surface.
    const transformationErrorFields = new Set(Object.keys(transformationErrors));
    for (const [field, errorMsg] of Object.entries(transformationErrors)) {
      const fieldDef = schema.fields[field];
      const expectedFormat = fieldDef?.type === 'DECIMAL' ? 'Example: 1250.50'
        : fieldDef?.type === 'NUMBER' ? 'Example: 1250'
        : fieldDef?.type === 'DATE' ? 'YYYY-MM-DD (example: 2026-09-28)'
        : fieldDef?.type === 'DATETIME' ? 'ISO 8601 datetime'
        : fieldDef?.type === 'EMAIL' ? 'name@company.com'
        : fieldDef?.type === 'PHONE' ? '7-15 digits; example +91 9000000001'
        : `Valid ${fieldDef?.type || 'field'} value`;
      issues.push({
        field,
        code: 'TRANSFORMATION_ERROR',
        severity: 'ERROR',
        message: `This value could not be safely converted for '${fieldDef?.label || field}'. ${errorMsg}`,
        sourceValue: rawData[field],
        transformedValue: transformedData[field],
        details: {
          action: `Enter a valid value for '${fieldDef?.label || field}'. The system could not safely correct the current value.`,
          expectedFormat,
          autoCorrected: false
        }
      });
    }

    // 1. Tier 2: Field-level validators
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      if (fieldDef.readOnly || transformationErrorFields.has(fieldName)) continue;

      const val = transformedData[fieldName];
      for (const validator of this.fieldValidators) {
        const fieldIssues = validator.validate(val, fieldDef, context);
        issues.push(...fieldIssues);
      }
    }

    // 2. Tier 3: Cross-field validators
    for (const crossValidator of this.crossFieldValidators) {
      const crossIssues = crossValidator.validate(transformedData, schema, context);
      issues.push(...crossIssues);
    }

    // 3. Tier 4: Entity-specific business rules
    const businessValidators = this.entityValidators.getValidatorsForEntity(schema.entity);
    for (const bValidator of businessValidators) {
      const bIssues = bValidator.validate(transformedData, schema, context);
      issues.push(...bIssues);
    }

    const hasErrors = issues.some((i) => i.severity === 'ERROR');
    const hasWarnings = issues.some((i) => i.severity === 'WARNING');

    let status: RecordStatus = RecordStatus.VALID;
    if (hasErrors) {
      status = RecordStatus.INVALID;
    } else if (hasWarnings) {
      status = RecordStatus.WARNING;
    }

    return {
      rowIndex,
      status,
      rawData,
      transformedData,
      issues,
      isValid: !hasErrors,
      hasWarnings,
      transformationAudit: undefined
    };
  }

  /**
   * Transforms and validates an entire dataset batch
   */
  public validateDataset(
    rawRows: Record<string, unknown>[],
    mapping: DataImportMappingEntity,
    schema: EntitySchemaDefinition,
    contextInfo: { organizationId: string; importId: string },
    existingDbValuesByField?: Record<string, Set<string>>
  ): { summary: ValidationSummary; results: RowValidationResult[] } {
    const startTime = Date.now();
    const results: RowValidationResult[] = [];

    let validRows = 0;
    let invalidRows = 0;
    let warningRows = 0;
    let errorCount = 0;
    let warningCount = 0;
    const fieldIssueCounts: Record<string, number> = {};
    const issuesByCode: Record<string, number> = {};

    for (let r = 0; r < rawRows.length; r++) {
      const rawRow = rawRows[r];

      // 1. Execute Transformation Pipeline
      const transformResult = this.pipeline.transformRow(
        r + 1,
        rawRow,
        mapping,
        schema,
        contextInfo
      );

      // 2. Execute Multi-Tier Validation
      const rowResult = this.validateRow(
        r + 1,
        rawRow,
        transformResult.transformedData,
        transformResult.transformationErrors,
        schema,
        contextInfo
      );
      rowResult.transformationAudit = transformResult.transformationAudit;

      results.push(rowResult);

      if (rowResult.status === RecordStatus.VALID) {
        validRows++;
      } else if (rowResult.status === RecordStatus.INVALID) {
        invalidRows++;
      } else if (rowResult.status === RecordStatus.WARNING) {
        warningRows++;
      }

      for (const issue of rowResult.issues) {
        if (issue.severity === 'ERROR') errorCount++;
        if (issue.severity === 'WARNING') warningCount++;

        fieldIssueCounts[issue.field] = (fieldIssueCounts[issue.field] || 0) + 1;
        issuesByCode[issue.code] = (issuesByCode[issue.code] || 0) + 1;
      }
    }

    // Uniqueness and duplicate validation is handled in Step 5 (Duplicate Matching & Scanning).
    // Step 4 focuses exclusively on field-level data quality (required, format, enum, type constraints).

    const durationMs = Date.now() - startTime;

    const summary: ValidationSummary = {
      totalRows: rawRows.length,
      validRows,
      invalidRows,
      warningRows,
      errorCount,
      warningCount,
      fieldIssueCounts,
      issuesByCode,
      durationMs
    };

    return { summary, results };
  }

  /**
   * Enforces schema-defined unique field rules across the dataset batch.
   * Checks Level A: Duplicates within the uploaded file (on normalized values).
   * Checks Level B: Duplicates against existing database records (optional set).
   */
  public applyUniquenessValidation(
    results: RowValidationResult[],
    schema: EntitySchemaDefinition,
    existingDbValuesByField?: Record<string, Set<string>>
  ): void {
    if (!schema?.fields) return;

    // Identify all schema fields configured as unique or IDENTIFIER type
    const uniqueFields = Object.entries(schema.fields)
      .filter(([_, fieldDef]) => fieldDef.unique === true);

    if (uniqueFields.length === 0) return;

    for (const [fieldName, fieldDef] of uniqueFields) {
      const label = fieldDef.label || fieldName;

      // Strip prior uniqueness issues for this field before re-evaluation
      for (const row of results) {
        row.issues = (row.issues || []).filter(
          (i) => i.field !== fieldName || (i.code !== 'DUPLICATE_KEY_IN_FILE' && i.code !== 'DUPLICATE_KEY_IN_DATABASE')
        );
      }

      // Level A: Build in-file frequency map on normalized values
      const frequencyMap = new Map<string, number>();
      for (const row of results) {
        const val = row.transformedData[fieldName];
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          const normKey = String(val).trim().toUpperCase();
          frequencyMap.set(normKey, (frequencyMap.get(normKey) || 0) + 1);
        }
      }

      // Level B: Existing database values for this field (if available)
      const dbValuesSet = existingDbValuesByField?.[fieldName];

      for (const row of results) {
        const val = row.transformedData[fieldName];
        if (val === null || val === undefined || String(val).trim() === '') {
          this.recalculateRowStatus(row);
          continue;
        }

        const normKey = String(val).trim().toUpperCase();
        const countInFile = frequencyMap.get(normKey) || 0;

        if (countInFile > 1) {
          row.issues.push({
            field: fieldName,
            code: 'DUPLICATE_KEY_IN_FILE',
            severity: 'WARNING',
            message: `Duplicate ${label} '${String(val).trim()}' found within this import file (${countInFile} occurrences)`,
            sourceValue: row.rawData[fieldName],
            transformedValue: val,
            details: {
              action: `Ensure '${label}' is unique across all rows in the dataset or configure duplicate resolution.`,
              duplicateLevel: 'IN_FILE',
              occurrences: countInFile,
              autoCorrected: false
            }
          });
        }

        if (dbValuesSet && dbValuesSet.has(normKey)) {
          row.issues.push({
            field: fieldName,
            code: 'DUPLICATE_KEY_IN_DATABASE',
            severity: 'WARNING',
            message: `Existing record found in database with ${label} '${String(val).trim()}'`,
            sourceValue: row.rawData[fieldName],
            transformedValue: val,
            details: {
              action: `Check existing database record or use update mode if intended.`,
              duplicateLevel: 'DATABASE',
              autoCorrected: false
            }
          });
        }

        this.recalculateRowStatus(row);
      }
    }
  }

  private recalculateRowStatus(row: RowValidationResult): void {
    const hasError = (row.issues || []).some((i) => i.severity === 'ERROR');
    const hasWarning = (row.issues || []).some((i) => i.severity === 'WARNING');
    if (hasError) {
      row.status = RecordStatus.INVALID;
    } else if (hasWarning) {
      row.status = RecordStatus.WARNING;
    } else {
      row.status = RecordStatus.VALID;
    }
    row.isValid = row.status === RecordStatus.VALID;
    row.hasWarnings = row.status === RecordStatus.WARNING;
  }
}

export const validationEngine = new ValidationEngine();
