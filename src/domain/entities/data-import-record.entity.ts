/**
 * Data Import Staged Record Domain Entity
 */

import { RecordStatus, DuplicateStrategy } from '../../core/types/import.types.js';
import { MatchClassification, ExecutionIntentAction } from '../../core/types/duplicate.types.js';
import { TransformationAuditEntry } from '../../core/types/transformation.types.js';

export interface RecordValidationErrorItem {
  field: string;
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFORMATION';
  sourceValue?: unknown;
  details?: Record<string, unknown>;
}

export interface DataImportRecordProps {
  id: string;
  organizationId: string;
  importId: string;
  rowIndex: number;
  rawData: Record<string, unknown>;
  transformedData?: Record<string, unknown> | null;
  transformationAudit?: Record<string, TransformationAuditEntry[]>;
  status?: RecordStatus;
  validationErrors?: RecordValidationErrorItem[];
  isDuplicate?: boolean;
  duplicateMatchId?: string | null;
  duplicateStrategy?: DuplicateStrategy | null;
  targetRecordId?: string | null;
  matchClassification?: MatchClassification | null;
  matchKey?: string | null;
  matchKeyHash?: string | null;
  candidateTargetIds?: string[];
  executionAction?: ExecutionIntentAction | null;
  executionReason?: string | null;
  isBlocked?: boolean;
  blockedReason?: string | null;
  executionError?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  retryCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class DataImportRecordEntity {
  public readonly id: string;
  public readonly organizationId: string;
  public readonly importId: string;
  public readonly rowIndex: number;
  public rawData: Record<string, unknown>;
  public transformedData: Record<string, unknown> | null;
  public transformationAudit: Record<string, TransformationAuditEntry[]>;
  public status: RecordStatus;
  public validationErrors: RecordValidationErrorItem[];
  public isDuplicate: boolean;
  public duplicateMatchId: string | null;
  public duplicateStrategy: DuplicateStrategy | null;
  public targetRecordId: string | null;
  public matchClassification: MatchClassification | null;
  public matchKey: string | null;
  public matchKeyHash: string | null;
  public candidateTargetIds: string[];
  public executionAction: ExecutionIntentAction | null;
  public executionReason: string | null;
  public isBlocked: boolean;
  public blockedReason: string | null;
  public executionError: string | null;
  public errorCode: string | null;
  public errorMessage: string | null;
  public retryCount: number;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: DataImportRecordProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.importId = props.importId;
    this.rowIndex = props.rowIndex;
    this.rawData = props.rawData;
    this.transformedData = props.transformedData ?? null;
    this.transformationAudit = props.transformationAudit ?? {};
    this.status = props.status ?? RecordStatus.PENDING;
    this.validationErrors = props.validationErrors ?? [];
    this.isDuplicate = props.isDuplicate ?? false;
    this.duplicateMatchId = props.duplicateMatchId ?? null;
    this.duplicateStrategy = props.duplicateStrategy ?? null;
    this.targetRecordId = props.targetRecordId ?? null;
    this.matchClassification = props.matchClassification ?? null;
    this.matchKey = props.matchKey ?? null;
    this.matchKeyHash = props.matchKeyHash ?? null;
    this.candidateTargetIds = props.candidateTargetIds ?? [];
    this.executionAction = props.executionAction ?? null;
    this.executionReason = props.executionReason ?? null;
    this.isBlocked = props.isBlocked ?? false;
    this.blockedReason = props.blockedReason ?? null;
    this.executionError = props.executionError ?? null;
    this.errorCode = props.errorCode ?? null;
    this.errorMessage = props.errorMessage ?? null;
    this.retryCount = props.retryCount ?? 0;
    this.createdAt = props.createdAt ? (props.createdAt instanceof Date ? props.createdAt : new Date(props.createdAt)) : new Date();
    this.updatedAt = props.updatedAt ? (props.updatedAt instanceof Date ? props.updatedAt : new Date(props.updatedAt)) : new Date();
  }

  public hasErrors(): boolean {
    return this.validationErrors.some((e) => e.severity === 'ERROR');
  }

  public hasWarnings(): boolean {
    return this.validationErrors.some((e) => e.severity === 'WARNING');
  }

  public toJSON() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      importId: this.importId,
      rowIndex: this.rowIndex,
      rawData: this.rawData,
      transformedData: this.transformedData,
      transformationAudit: this.transformationAudit,
      status: this.status,
      validationErrors: this.validationErrors,
      isDuplicate: this.isDuplicate,
      duplicateMatchId: this.duplicateMatchId,
      duplicateStrategy: this.duplicateStrategy,
      targetRecordId: this.targetRecordId,
      matchClassification: this.matchClassification,
      matchKey: this.matchKey,
      matchKeyHash: this.matchKeyHash,
      candidateTargetIds: this.candidateTargetIds,
      executionAction: this.executionAction,
      executionReason: this.executionReason,
      isBlocked: this.isBlocked,
      blockedReason: this.blockedReason,
      executionError: this.executionError,
      retryCount: this.retryCount,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
