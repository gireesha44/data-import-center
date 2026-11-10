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
export declare class DataImportRecordEntity {
    readonly id: string;
    readonly organizationId: string;
    readonly importId: string;
    readonly rowIndex: number;
    rawData: Record<string, unknown>;
    transformedData: Record<string, unknown> | null;
    transformationAudit: Record<string, TransformationAuditEntry[]>;
    status: RecordStatus;
    validationErrors: RecordValidationErrorItem[];
    isDuplicate: boolean;
    duplicateMatchId: string | null;
    duplicateStrategy: DuplicateStrategy | null;
    targetRecordId: string | null;
    matchClassification: MatchClassification | null;
    matchKey: string | null;
    matchKeyHash: string | null;
    candidateTargetIds: string[];
    executionAction: ExecutionIntentAction | null;
    executionReason: string | null;
    isBlocked: boolean;
    blockedReason: string | null;
    executionError: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    retryCount: number;
    readonly createdAt: Date;
    updatedAt: Date;
    constructor(props: DataImportRecordProps);
    hasErrors(): boolean;
    hasWarnings(): boolean;
    toJSON(): {
        id: string;
        organizationId: string;
        importId: string;
        rowIndex: number;
        rawData: Record<string, unknown>;
        transformedData: Record<string, unknown> | null;
        transformationAudit: Record<string, TransformationAuditEntry[]>;
        status: RecordStatus;
        validationErrors: RecordValidationErrorItem[];
        isDuplicate: boolean;
        duplicateMatchId: string | null;
        duplicateStrategy: DuplicateStrategy | null;
        targetRecordId: string | null;
        matchClassification: MatchClassification | null;
        matchKey: string | null;
        matchKeyHash: string | null;
        candidateTargetIds: string[];
        executionAction: ExecutionIntentAction | null;
        executionReason: string | null;
        isBlocked: boolean;
        blockedReason: string | null;
        executionError: string | null;
        retryCount: number;
        createdAt: string;
        updatedAt: string;
    };
}
//# sourceMappingURL=data-import-record.entity.d.ts.map