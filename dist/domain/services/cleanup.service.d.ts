/**
 * Temporary Data Retention & Cleanup Domain Service
 */
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { IFileStorageService } from '../../infrastructure/storage/file-storage.service.js';
import { RetentionPolicyConfig } from '../../core/types/reconciliation.types.js';
import { StructuredLogger } from '../../core/logging/structured-logger.js';
import { IAuditService } from './audit.service.interface.js';
export interface CleanupResultSummary {
    inspectedJobs: number;
    cleanedFilesCount: number;
    cleanedStagedRecordsCount: number;
    durationMs: number;
}
export declare class CleanupService {
    private readonly importRepository;
    private readonly recordRepository;
    private readonly fileStorageService?;
    private readonly auditServiceInstance;
    private readonly logger;
    private retentionConfig;
    constructor(importRepository: IDataImportRepository, recordRepository: IDataImportRecordRepository, fileStorageService?: IFileStorageService | undefined, auditServiceInstance?: IAuditService, logger?: StructuredLogger, retentionConfig?: Partial<RetentionPolicyConfig>);
    /**
     * Cleans up expired temporary files for completed imports past retention window
     */
    executeCleanup(organizationId: string): Promise<CleanupResultSummary>;
}
//# sourceMappingURL=cleanup.service.d.ts.map