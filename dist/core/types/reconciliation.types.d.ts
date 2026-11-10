/**
 * Post-Import Reconciliation, Reporting, Error Recovery & Hardening Types
 */
import { RecordStatus, ExecutionStatus, ImportStatus } from './import.types.js';
import { ExecutionIntentAction } from './duplicate.types.js';
export declare enum ReconciliationStatus {
    FULLY_RECONCILED = "FULLY_RECONCILED",
    PARTIALLY_RECONCILED = "PARTIALLY_RECONCILED",
    MISMATCHED = "MISMATCHED",
    RECONCILIATION_FAILED = "RECONCILIATION_FAILED"
}
export declare enum ReconciliationMismatchType {
    INTENT_RESULT_MISMATCH = "INTENT_RESULT_MISMATCH",
    TARGET_ID_MISMATCH = "TARGET_ID_MISMATCH",
    UNEXECUTED_PLANNED_RECORD = "UNEXECUTED_PLANNED_RECORD",
    UNEXPECTED_EXECUTION_RESULT = "UNEXPECTED_EXECUTION_RESULT"
}
export interface ReconciliationMismatch {
    recordId: string;
    rowIndex: number;
    type: ReconciliationMismatchType;
    plannedAction: ExecutionIntentAction;
    actualStatus: RecordStatus;
    expectedTargetId?: string | null;
    actualTargetId?: string | null;
    message: string;
    severity: 'ERROR' | 'WARNING';
}
export interface ReconciliationResult {
    importId: string;
    sourceRows: number;
    sourceColumns: number;
    validatedRows: number;
    invalidRows: number;
    warningRows: number;
    correctedRows: number;
    duplicateRows: number;
    executionId: string;
    plannedRecords: number;
    attemptedRecords: number;
    successfulRecords: number;
    createdRecords: number;
    updatedRecords: number;
    skippedRecords: number;
    rejectedRecords?: number;
    blockedRecords: number;
    failedRecords: number;
    varianceCount?: number;
    mismatchCount: number;
    mismatches: ReconciliationMismatch[];
    status: ReconciliationStatus;
    reconciledAt: Date;
    durationMs: number;
}
export type Retryability = 'RETRYABLE' | 'NON_RETRYABLE' | 'UNKNOWN';
export type ErrorCategory = 'VALIDATION_ERROR' | 'MAPPING_ERROR' | 'MATCH_ERROR' | 'AUTHORIZATION_ERROR' | 'TARGET_NOT_FOUND' | 'CONSTRAINT_ERROR' | 'CONFLICT_ERROR' | 'TRANSIENT_ERROR' | 'SYSTEM_ERROR' | 'UNKNOWN_ERROR';
export interface FailedRecordItem {
    id: string;
    rowIndex: number;
    rawData: Record<string, unknown>;
    transformedData: Record<string, unknown> | null;
    plannedAction: ExecutionIntentAction;
    status: RecordStatus;
    errorCode: string;
    errorMessage: string;
    errorCategory: ErrorCategory;
    retryability: Retryability;
    retryCount: number;
    maxRetries: number;
    isRetryable: boolean;
    lastAttemptedAt?: Date | null;
}
export interface FinalImportReport {
    importInfo: {
        importId: string;
        organizationId: string;
        name: string;
        targetModule: string;
        targetEntity: string;
        status: ImportStatus;
        createdBy: string;
        createdAt: Date;
        startedAt?: Date | null;
        completedAt?: Date | null;
        durationMs?: number;
        version: number;
    };
    processing: {
        totalRows: number;
        columnCount: number;
        correctedRows: number;
        parsedRows: number;
        validRows: number;
        invalidRows: number;
        warningRows: number;
    };
    matching: {
        newRecords: number;
        existingRecords: number;
        duplicateInFile: number;
        duplicateRows: number;
        conflicts: number;
        unresolved: number;
    };
    execution: {
        executionId?: string;
        status?: ExecutionStatus;
        totalAttempted: number;
        created: number;
        updated: number;
        skipped: number;
        rejected: number;
        blocked: number;
        failed: number;
        retryCount: number;
    };
    reconciliation: {
        status: ReconciliationStatus;
        isFullyReconciled: boolean;
        mismatchCount: number;
        varianceCount: number;
        sourceRows: number;
        accountedRows: number;
        affectedRows: Array<{
            rowIndex: number;
            message: string;
        }>;
        mismatchesSummary: Array<{
            type: ReconciliationMismatchType;
            count: number;
        }>;
    };
    approval: {
        status: string;
        approverLabel?: string;
        assignedApproverRole?: string;
        submittedBy?: string;
        submittedAt?: string;
        decidedBy?: string;
        decidedByRole?: string;
        decidedAt?: string;
        reason?: string;
    };
    performance: {
        parseDurationMs?: number;
        validationDurationMs?: number;
        matchingDurationMs?: number;
        executionDurationMs?: number;
        reconciliationDurationMs?: number;
        totalDurationMs?: number;
    };
    failedRecordsSummary: {
        totalFailed: number;
        retryableCount: number;
        nonRetryableCount: number;
        topErrorCodes: Array<{
            code: string;
            count: number;
        }>;
    };
}
export interface FailedRecordsFilterQuery {
    page?: number;
    limit?: number;
    category?: ErrorCategory;
    retryability?: Retryability;
    errorCode?: string;
}
export interface RetryImportOptions {
    maxRetries?: number;
    recordIds?: string[];
    forceRetryAll?: boolean;
}
export interface RetryExecutionResult {
    importId: string;
    retryAttempt: number;
    recordsRetried: number;
    newlySucceeded: number;
    stillFailing: number;
    reconciliationStatus: ReconciliationStatus;
    completedAt: Date;
    durationMs: number;
}
export interface RetentionPolicyConfig {
    tempFilesRetentionDays: number;
    stagedRecordsRetentionDays: number;
    expiredPreviewRetentionHours: number;
}
//# sourceMappingURL=reconciliation.types.d.ts.map