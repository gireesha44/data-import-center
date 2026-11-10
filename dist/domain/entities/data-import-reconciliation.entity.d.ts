/**
 * Data Import Reconciliation Domain Entity
 */
import { ReconciliationStatus, ReconciliationMismatch } from '../../core/types/reconciliation.types.js';
export interface DataImportReconciliationProps {
    id: string;
    organizationId: string;
    importId: string;
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
export declare class DataImportReconciliationEntity {
    readonly id: string;
    readonly organizationId: string;
    readonly importId: string;
    readonly executionId: string;
    plannedRecords: number;
    attemptedRecords: number;
    successfulRecords: number;
    createdRecords: number;
    updatedRecords: number;
    skippedRecords: number;
    rejectedRecords: number;
    blockedRecords: number;
    failedRecords: number;
    varianceCount: number;
    mismatchCount: number;
    mismatches: ReconciliationMismatch[];
    status: ReconciliationStatus;
    readonly reconciledAt: Date;
    durationMs: number;
    constructor(props: DataImportReconciliationProps);
    isFullyReconciled(): boolean;
}
//# sourceMappingURL=data-import-reconciliation.entity.d.ts.map