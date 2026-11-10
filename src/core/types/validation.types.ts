/**
 * Core Type Definitions for Multi-Tier Validation Engine
 */

import { EntityFieldDefinition, EntitySchemaDefinition } from '../registry/entity-schema.registry.js';
import { RecordStatus } from './import.types.js';
import { TransformationAuditEntry } from './transformation.types.js';

export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFORMATION';

export type ValidationScope = 'FIELD' | 'ROW' | 'DATASET';

export interface FieldValidationIssue {
  field: string;
  code: string;
  severity: ValidationSeverity;
  message: string;
  sourceValue?: unknown;
  transformedValue?: unknown;
  details?: Record<string, unknown>;
}

export interface ValidationContext {
  organizationId: string;
  importId: string;
  targetEntity: string;
  rowIndex: number;
  rawData: Record<string, unknown>;
  transformedData: Record<string, unknown>;
  schema: EntitySchemaDefinition;
  config?: Record<string, unknown>;
}

export interface RowValidationResult {
  rowIndex: number;
  status: RecordStatus;
  rawData: Record<string, unknown>;
  transformedData: Record<string, unknown>;
  issues: FieldValidationIssue[];
  isValid: boolean;
  hasWarnings: boolean;
  transformationAudit?: Record<string, TransformationAuditEntry[]>;
}

export interface ValidationErrorGroup {
  code: string;
  name: string;
  count: number;
  severity: ValidationSeverity;
  affectedColumns: string[];
  examples: string[];
}

export interface ColumnQualitySummary {
  field: string;
  label?: string;
  type: string;
  total: number;
  valid: number;
  invalid: number;
  empty: number;
  duplicate: number;
}

export interface CorrectionAuditSummary {
  column: string;
  originalValue: string;
  correctedValue: string;
  reason: string;
  count: number;
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  errorCount: number;
  warningCount: number;
  fieldIssueCounts: Record<string, number>;
  issuesByCode: Record<string, number>;
  durationMs: number;
  correctedRows?: number;
  duplicateRows?: number;
  rowsRequiringAction?: number;
  errorGroups?: ValidationErrorGroup[];
  columnStatistics?: ColumnQualitySummary[];
  correctionsSummary?: CorrectionAuditSummary[];
}

export interface IFieldValidator {
  readonly name: string;
  validate(
    value: unknown,
    fieldDef: EntityFieldDefinition,
    context: ValidationContext
  ): FieldValidationIssue[];
}

export interface ICrossFieldValidator {
  readonly name: string;
  validate(
    row: Record<string, unknown>,
    schema: EntitySchemaDefinition,
    context: ValidationContext
  ): FieldValidationIssue[];
}

export interface IBusinessValidator {
  readonly name: string;
  readonly entity: string;
  validate(
    row: Record<string, unknown>,
    schema: EntitySchemaDefinition,
    context: ValidationContext
  ): FieldValidationIssue[];
}
