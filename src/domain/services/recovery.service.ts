/**
 * Orphan Detection & Crash Recovery Service
 */

import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportExecutionRepository } from '../repositories/data-import-execution.repository.interface.js';
import { ImportStateMachine } from '../state-machine/import-state-machine.js';
import { ImportStatus, ExecutionStatus } from '../../core/types/import.types.js';
import { StructuredLogger, logger as defaultLogger } from '../../core/logging/structured-logger.js';
import { auditService } from '../../infrastructure/services/audit.service.js';
import { IAuditService } from './audit.service.interface.js';

export interface OrphanedJobRecoverySummary {
  inspectedJobs: number;
  recoveredJobs: number;
  recoveredJobIds: string[];
}

export class RecoveryService {
  constructor(
    private readonly importRepository: IDataImportRepository,
    private readonly executionRepository: IDataImportExecutionRepository,
    private readonly auditServiceInstance: IAuditService = auditService,
    private readonly logger: StructuredLogger = defaultLogger
  ) {}

  /**
   * Detects and safely recovers execution jobs stuck in processing with no heartbeat
   */
  public async detectAndRecoverOrphans(
    organizationId: string,
    maxInactiveMs: number = 15 * 60 * 1000 // 15 minutes default
  ): Promise<OrphanedJobRecoverySummary> {
    const activeJobs = await this.importRepository.findMany(organizationId, {
      status: ImportStatus.PROCESSING,
      limit: 1000
    });

    const now = Date.now();
    const recoveredJobIds: string[] = [];

    for (const job of activeJobs.data) {
      const lastActive = job.updatedAt ? job.updatedAt.getTime() : job.createdAt.getTime();
      const inactiveDuration = now - lastActive;

      if (inactiveDuration > maxInactiveMs) {
        this.logger.warn('Detected orphaned import job stuck in PROCESSING state', {
          importId: job.id,
          inactiveDurationMs: inactiveDuration
        });

        // Recover import state to FAILED
        ImportStateMachine.transition(job, ImportStatus.FAILED);
        await this.importRepository.update(job);

        // Update corresponding execution record if exists
        const execution = await this.executionRepository.findByImportId(organizationId, job.id);
        if (execution && execution.status === ExecutionStatus.IN_PROGRESS) {
          execution.status = ExecutionStatus.FAILED;
          execution.finishedAt = new Date();
          execution.errorSummary = {
            timeout: true,
            message: `Execution timed out and was recovered by orphan detector (Inactive for ${Math.round(
              inactiveDuration / 1000
            )}s)`
          };
          await this.executionRepository.update(execution);
        }

        await this.auditServiceInstance.recordEvent({
          organizationId,
          importId: job.id,
          actorUserId: 'SYSTEM_RECOVERY_WORKER',
          action: 'IMPORT_ORPHAN_RECOVERED',
          details: {
            inactiveDurationMs: inactiveDuration,
            previousStatus: ImportStatus.PROCESSING,
            newStatus: ImportStatus.FAILED
          }
        });

        recoveredJobIds.push(job.id);
      }
    }

    return {
      inspectedJobs: activeJobs.pagination.total,
      recoveredJobs: recoveredJobIds.length,
      recoveredJobIds
    };
  }
}
