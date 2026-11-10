/**
 * Data Import Approval Domain Entity
 */
import { ApprovalStatus } from '../../core/types/import.types.js';
export interface DataImportApprovalProps {
    id: string;
    organizationId: string;
    importId: string;
    decision?: ApprovalStatus;
    requestedBy: string;
    requestedAt?: Date;
    assignedApproverRole?: string | null;
    decidedBy?: string | null;
    decidedByRole?: string | null;
    decidedAt?: Date | null;
    reason?: string | null;
    snapshotHash: string;
    invalidationReason?: string | null;
}
export declare class DataImportApprovalEntity {
    readonly id: string;
    readonly organizationId: string;
    readonly importId: string;
    decision: ApprovalStatus;
    readonly requestedBy: string;
    readonly requestedAt: Date;
    assignedApproverRole: string | null;
    decidedBy: string | null;
    decidedByRole: string | null;
    decidedAt: Date | null;
    reason: string | null;
    snapshotHash: string;
    invalidationReason: string | null;
    constructor(props: DataImportApprovalProps);
    isPending(): boolean;
    isApproved(): boolean;
    isRejected(): boolean;
    isInvalidated(): boolean;
    toJSON(): {
        id: string;
        organizationId: string;
        importId: string;
        decision: ApprovalStatus;
        requestedBy: string;
        requestedAt: string;
        assignedApproverRole: string | null;
        decidedBy: string | null;
        decidedByRole: string | null;
        decidedAt: string | null;
        reason: string | null;
        snapshotHash: string;
        invalidationReason: string | null;
    };
}
//# sourceMappingURL=data-import-approval.entity.d.ts.map