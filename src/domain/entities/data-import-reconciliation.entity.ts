/**
 * Data Import Reconciliation Domain Entity
 */

import {
  ReconciliationStatus,
  ReconciliationMismatch
} from '../../core/types/reconciliation.types.js';

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

export class DataImportReconciliationEntity {
  public readonly id: string;
  public readonly organizationId: string;
  public readonly importId: string;
  public readonly executionId: string;
  public plannedRecords: number;
  public attemptedRecords: number;
  public successfulRecords: number;
  public createdRecords: number;
  public updatedRecords: number;
  public skippedRecords: number;
  public rejectedRecords: number;
  public blockedRecords: number;
  public failedRecords: number;
  public varianceCount: number;
  public mismatchCount: number;
  public mismatches: ReconciliationMismatch[];
  public status: ReconciliationStatus;
  public readonly reconciledAt: Date;
  public durationMs: number;

  constructor(props: DataImportReconciliationProps) {
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

  public isFullyReconciled(): boolean {
    return this.status === ReconciliationStatus.FULLY_RECONCILED &&
      this.mismatchCount === 0 &&
      this.varianceCount === 0;
  }
}
