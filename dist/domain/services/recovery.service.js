/**
 * Orphan Detection & Crash Recovery Service
 */
import { ImportStateMachine } from '../state-machine/import-state-machine.js';
import { ImportStatus, ExecutionStatus } from '../../core/types/import.types.js';
import { logger as defaultLogger } from '../../core/logging/structured-logger.js';
import { auditService } from '../../infrastructure/services/audit.service.js';
export class RecoveryService {
    importRepository;
    executionRepository;
    auditServiceInstance;
    logger;
    constructor(importRepository, executionRepository, auditServiceInstance = auditService, logger = defaultLogger) {
        this.importRepository = importRepository;
        this.executionRepository = executionRepository;
        this.auditServiceInstance = auditServiceInstance;
        this.logger = logger;
    }
    /**
     * Detects and safely recovers execution jobs stuck in processing with no heartbeat
     */
    async detectAndRecoverOrphans(organizationId, maxInactiveMs = 15 * 60 * 1000 // 15 minutes default
    ) {
        const activeJobs = await this.importRepository.findMany(organizationId, {
            status: ImportStatus.PROCESSING,
            limit: 1000
        });
        const now = Date.now();
        const recoveredJobIds = [];
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
                        message: `Execution timed out and was recovered by orphan detector (Inactive for ${Math.round(inactiveDuration / 1000)}s)`
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
//# sourceMappingURL=recovery.service.js.map