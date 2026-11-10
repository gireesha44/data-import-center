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
export declare class DataImportExecutionEntity {
    readonly id: string;
    readonly organizationId: string;
    readonly importId: string;
    status: ExecutionStatus;
    workerNodeId: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    durationMs: number | null;
    batchSize: number;
    totalBatches: number;
    completedBatches: number;
    recordsSucceeded: number;
    recordsFailed: number;
    errorSummary: Record<string, unknown>;
    cancelledBy: string | null;
    constructor(props: DataImportExecutionProps);
    toJSON(): {
        id: string;
        organizationId: string;
        importId: string;
        status: ExecutionStatus;
        workerNodeId: string | null;
        startedAt: string | null;
        finishedAt: string | null;
        durationMs: number | null;
        batchSize: number;
        totalBatches: number;
        completedBatches: number;
        recordsSucceeded: number;
        recordsFailed: number;
        errorSummary: Record<string, unknown>;
        cancelledBy: string | null;
    };
}
//# sourceMappingURL=data-import-execution.entity.d.ts.map