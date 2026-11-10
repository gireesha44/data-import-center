/**
 * Data Import Reconciliation Domain Entity
 */
import { ReconciliationStatus } from '../../core/types/reconciliation.types.js';
export class DataImportReconciliationEntity {
    id;
    organizationId;
    importId;
    executionId;
    plannedRecords;
    attemptedRecords;
    successfulRecords;
    createdRecords;
    updatedRecords;
    skippedRecords;
    rejectedRecords;
    blockedRecords;
    failedRecords;
    varianceCount;
    mismatchCount;
    mismatches;
    status;
    reconciledAt;
    durationMs;
    constructor(props) {
        this.id = props.id;
        this.organizationId = props.organizationId;
        this.importId = props.importId;
        this.executionId = props.executionId;
        this.plannedRecords = props.plannedRecords;
        this.attemptedRecords = props.attemptedRecords;
        this.successfulRecords = props.successfulRecords;
        this.createdRecords = props.createdRecords;
        this.updatedRecords = props.updatedRecords;
        this.skippedRecords = props.skippedRecords;
        this.rejectedRecords = props.rejectedRecords ?? 0;
        this.blockedRecords = props.blockedRecords;
        this.failedRecords = props.failedRecords;
        this.varianceCount = props.varianceCount ?? 0;
        this.mismatchCount = props.mismatchCount;
        this.mismatches = props.mismatches || [];
        this.status = props.status;
        this.reconciledAt = props.reconciledAt || new Date();
        this.durationMs = props.durationMs || 0;
    }
    isFullyReconciled() {
        return this.status === ReconciliationStatus.FULLY_RECONCILED &&
            this.mismatchCount === 0 &&
            this.varianceCount === 0;
    }
}
//# sourceMappingURL=data-import-reconciliation.entity.js.map