/**
 * Temporary Data Retention & Cleanup Domain Service
 */

import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { IFileStorageService } from '../../infrastructure/storage/file-storage.service.js';
import { RetentionPolicyConfig } from '../../core/types/reconciliation.types.js';
import { ImportStatus } from '../../core/types/import.types.js';
import { StructuredLogger, logger as defaultLogger } from '../../core/logging/structured-logger.js';
import { auditService } from '../../infrastructure/services/audit.service.js';
import { IAuditService } from './audit.service.interface.js';

export interface CleanupResultSummary {
  inspectedJobs: number;
  cleanedFilesCount: number;
  cleanedStagedRecordsCount: number;
  durationMs: number;
}

export class CleanupService {
  private retentionConfig: RetentionPolicyConfig;

  constructor(
    private readonly importRepository: IDataImportRepository,
    private readonly recordRepository: IDataImportRecordRepository,
    private readonly fileStorageService?: IFileStorageService,
    private readonly auditServiceInstance: IAuditService = auditService,
    private readonly logger: StructuredLogger = defaultLogger,
    retentionConfig?: Partial<RetentionPolicyConfig>
  ) {
    this.retentionConfig = {
      tempFilesRetentionDays: retentionConfig?.tempFilesRetentionDays || 30,
      stagedRecordsRetentionDays: retentionConfig?.stagedRecordsRetentionDays || 60,
      expiredPreviewRetentionHours: retentionConfig?.expiredPreviewRetentionHours || 48
    };
  }

  /**
   * Cleans up expired temporary files for completed imports past retention window
   */
  public async executeCleanup(
    organizationId: string
  ): Promise<CleanupResultSummary> {
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
          } catch (err: any) {
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
