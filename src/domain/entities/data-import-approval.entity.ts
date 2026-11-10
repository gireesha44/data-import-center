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

export class DataImportApprovalEntity {
  public readonly id: string;
  public readonly organizationId: string;
  public readonly importId: string;
  public decision: ApprovalStatus;
  public readonly requestedBy: string;
  public readonly requestedAt: Date;
  public assignedApproverRole: string | null;
  public decidedBy: string | null;
  public decidedByRole: string | null;
  public decidedAt: Date | null;
  public reason: string | null;
  public snapshotHash: string;
  public invalidationReason: string | null;

  constructor(props: DataImportApprovalProps) {
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

  public isPending(): boolean {
    return this.decision === ApprovalStatus.PENDING;
  }

  public isApproved(): boolean {
    return this.decision === ApprovalStatus.APPROVED;
  }

  public isRejected(): boolean {
    return this.decision === ApprovalStatus.REJECTED;
  }

  public isInvalidated(): boolean {
    return this.decision === ApprovalStatus.INVALIDATED;
  }

  public toJSON() {
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
