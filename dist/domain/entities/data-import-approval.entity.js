/**
 * Data Import Approval Domain Entity
 */
import { ApprovalStatus } from '../../core/types/import.types.js';
export class DataImportApprovalEntity {
    id;
    organizationId;
    importId;
    decision;
    requestedBy;
    requestedAt;
    assignedApproverRole;
    decidedBy;
    decidedByRole;
    decidedAt;
    reason;
    snapshotHash;
    invalidationReason;
    constructor(props) {
        this.id = props.id;
        this.organizationId = props.organizationId;
        this.importId = props.importId;
        this.decision = props.decision ?? ApprovalStatus.PENDING;
        this.requestedBy = props.requestedBy;
        this.requestedAt = props.requestedAt ? (props.requestedAt instanceof Date ? props.requestedAt : new Date(props.requestedAt)) : new Date();
        this.assignedApproverRole = props.assignedApproverRole ?? null;
        this.decidedBy = props.decidedBy ?? null;
        this.decidedByRole = props.decidedByRole ?? null;
        this.decidedAt = props.decidedAt ? (props.decidedAt instanceof Date ? props.decidedAt : new Date(props.decidedAt)) : null;
        this.reason = props.reason ?? null;
        this.snapshotHash = props.snapshotHash;
        this.invalidationReason = props.invalidationReason ?? null;
    }
    isPending() {
        return this.decision === ApprovalStatus.PENDING;
    }
    isApproved() {
        return this.decision === ApprovalStatus.APPROVED;
    }
    isRejected() {
        return this.decision === ApprovalStatus.REJECTED;
    }
    isInvalidated() {
        return this.decision === ApprovalStatus.INVALIDATED;
    }
    toJSON() {
        return {
            id: this.id,
            organizationId: this.organizationId,
            importId: this.importId,
            decision: this.decision,
            requestedBy: this.requestedBy,
            requestedAt: this.requestedAt.toISOString(),
            assignedApproverRole: this.assignedApproverRole,
            decidedBy: this.decidedBy,
            decidedByRole: this.decidedByRole,
            decidedAt: this.decidedAt ? this.decidedAt.toISOString() : null,
            reason: this.reason,
            snapshotHash: this.snapshotHash,
            invalidationReason: this.invalidationReason
        };
    }
}
//# sourceMappingURL=data-import-approval.entity.js.map