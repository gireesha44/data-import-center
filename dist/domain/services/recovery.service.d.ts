/**
 * Orphan Detection & Crash Recovery Service
 */
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportExecutionRepository } from '../repositories/data-import-execution.repository.interface.js';
import { StructuredLogger } from '../../core/logging/structured-logger.js';
import { IAuditService } from './audit.service.interface.js';
export interface OrphanedJobRecoverySummary {
    inspectedJobs: number;
    recoveredJobs: number;
    recoveredJobIds: string[];
}
export declare class RecoveryService {
    private readonly importRepository;
    private readonly executionRepository;
    private readonly auditServiceInstance;
    private readonly logger;
    constructor(importRepository: IDataImportRepository, executionRepository: IDataImportExecutionRepository, auditServiceInstance?: IAuditService, logger?: StructuredLogger);
    /**
     * Detects and safely recovers execution jobs stuck in processing with no heartbeat
     */
    detectAndRecoverOrphans(organizationId: string, maxInactiveMs?: number): Promise<OrphanedJobRecoverySummary>;
}
//# sourceMappingURL=recovery.service.d.ts.map