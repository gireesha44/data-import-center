/**
 * Data Import Execution Domain Entity
 */

import { ExecutionStatus } from '../../core/types/import.types.js';

export interface DataImportExecutionProps {
  id: string;
  organizationId: string;
  importId: string;
  status?: ExecutionStatus;
  workerNodeId?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  durationMs?: number | null;
  batchSize?: number;
  totalBatches?: number;
  completedBatches?: number;
  recordsSucceeded?: number;
  recordsFailed?: number;
  errorSummary?: Record<string, unknown>;
  cancelledBy?: string | null;
}

export class DataImportExecutionEntity {
  public readonly id: string;
  public readonly organizationId: string;
  public readonly importId: string;
  public status: ExecutionStatus;
  public workerNodeId: string | null;
  public startedAt: Date | null;
  public finishedAt: Date | null;
  public durationMs: number | null;
  public batchSize: number;
  public totalBatches: number;
  public completedBatches: number;
  public recordsSucceeded: number;
  public recordsFailed: number;
  public errorSummary: Record<string, unknown>;
  public cancelledBy: string | null;

  constructor(props: DataImportExecutionProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.importId = props.importId;
    this.status = props.status ?? ExecutionStatus.INITIALIZED;
    this.workerNodeId = props.workerNodeId ?? null;
    this.startedAt = props.startedAt ? (props.startedAt instanceof Date ? props.startedAt : new Date(props.startedAt)) : null;
    this.finishedAt = props.finishedAt ? (props.finishedAt instanceof Date ? props.finishedAt : new Date(props.finishedAt)) : null;
    this.durationMs = props.durationMs ?? null;
    this.batchSize = props.batchSize ?? 500;
    this.totalBatches = props.totalBatches ?? 0;
    this.completedBatches = props.completedBatches ?? 0;
    this.recordsSucceeded = props.recordsSucceeded ?? 0;
    this.recordsFailed = props.recordsFailed ?? 0;
    this.errorSummary = props.errorSummary ?? {};
    this.cancelledBy = props.cancelledBy ?? null;
  }

  public toJSON() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      importId: this.importId,
      status: this.status,
      workerNodeId: this.workerNodeId,
      startedAt: this.startedAt ? this.startedAt.toISOString() : null,
      finishedAt: this.finishedAt ? this.finishedAt.toISOString() : null,
      durationMs: this.durationMs,
      batchSize: this.batchSize,
      totalBatches: this.totalBatches,
      completedBatches: this.completedBatches,
      recordsSucceeded: this.recordsSucceeded,
      recordsFailed: this.recordsFailed,
      errorSummary: this.errorSummary,
      cancelledBy: this.cancelledBy
    };
  }
}
