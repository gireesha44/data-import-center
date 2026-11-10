/**
 * Temporary Data Retention & Cleanup Domain Service
 */
import { ImportStatus } from '../../core/types/import.types.js';
import { logger as defaultLogger } from '../../core/logging/structured-logger.js';
import { auditService } from '../../infrastructure/services/audit.service.js';
export class CleanupService {
    importRepository;
    recordRepository;
    fileStorageService;
    auditServiceInstance;
    logger;
    retentionConfig;
    constructor(importRepository, recordRepository, fileStorageService, auditServiceInstance = auditService, logger = defaultLogger, retentionConfig) {
        this.importRepository = importRepository;
        this.recordRepository = recordRepository;
        this.fileStorageService = fileStorageService;
        this.auditServiceInstance = auditServiceInstance;
        this.logger = logger;
        this.retentionConfig = {
            tempFilesRetentionDays: retentionConfig?.tempFilesRetentionDays || 30,
            stagedRecordsRetentionDays: retentionConfig?.stagedRecordsRetentionDays || 60,
            expiredPreviewRetentionHours: retentionConfig?.expiredPreviewRetentionHours || 48
        };
    }
    /**
     * Cleans up expired temporary files for completed imports past retention window
     */
    async executeCleanup(organizationId) {
        const startTime = Date.now();
        const completedJobs = await this.importRepository.findMany(organizationId, {
            status: ImportStatus.COMPLETED,
            limit: 1000
        });
        const now = Date.now();
        const tempFileRetentionMs = this.retentionConfig.tempFilesRetentionDays * 24 * 60 * 60 * 1000;
        let cleanedFilesCount = 0;
        let cleanedStagedRecordsCount = 0;
        for (const job of completedJobs.data) {
            const completedTime = job.completedAt ? job.completedAt.getTime() : job.updatedAt.getTime();
            const ageMs = now - completedTime;
            if (ageMs > tempFileRetentionMs) {
                if (job.fileStoragePath && this.fileStorageService) {
                    try {
                        await this.fileStorageService.deleteFile(job.fileStoragePath);
                        job.fileStoragePath = null;
                        await this.importRepository.update(job);
                        cleanedFilesCount++;
                    }
                    catch (err) {
                        this.logger.warn('Failed to delete expired import file during cleanup', {
                            importId: job.id,
                            error: err.message
                        });
                    }
                }
            }
        }
        const durationMs = Date.now() - startTime;
        await this.auditServiceInstance.recordEvent({
            organizationId,
            importId: 'system_cleanup_job',
            actorUserId: 'SYSTEM_CLEANUP_WORKER',
            action: 'DATA_RETENTION_CLEANUP',
            details: {
                cleanedFilesCount,
                cleanedStagedRecordsCount,
                durationMs
            }
        });
        this.logger.info('Data retention cleanup executed', {
            organizationId,
            cleanedFilesCount,
            durationMs
        });
        return {
            inspectedJobs: completedJobs.pagination.total,
            cleanedFilesCount,
            cleanedStagedRecordsCount,
            durationMs
        };
    }
}
//# sourceMappingURL=cleanup.service.js.map