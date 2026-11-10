/**
 * Failed Record Controlled Retry Service
 */
import { RecordStatus } from '../../core/types/import.types.js';
import { ExecutionIntentAction } from '../../core/types/duplicate.types.js';
import { hasPermission, DataImportPermission } from '../../core/types/permissions.types.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../core/errors/import.errors.js';
import { auditService } from '../../infrastructure/services/audit.service.js';
import { logger as defaultLogger } from '../../core/logging/structured-logger.js';
import { metricsService as defaultMetrics } from './metrics.service.js';
export class RetryService {
    importRepository;
    recordRepository;
    executionRepository;
    targetRegistry;
    reconciliationService;
    reportingService;
    auditServiceInstance;
    logger;
    metrics;
    constructor(importRepository, recordRepository, executionRepository, targetRegistry, reconciliationService, reportingService, auditServiceInstance = auditService, logger = defaultLogger, metrics = defaultMetrics) {
        this.importRepository = importRepository;
        this.recordRepository = recordRepository;
        this.executionRepository = executionRepository;
        this.targetRegistry = targetRegistry;
        this.reconciliationService = reconciliationService;
        this.reportingService = reportingService;
        this.auditServiceInstance = auditServiceInstance;
        this.logger = logger;
        this.metrics = metrics;
    }
    /**
     * Safely retries eligible failed records with retry limit enforcement
     */
    async retryFailedRecords(context, importId, options = {}) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_EXECUTE)) {
            throw new ForbiddenError('Insufficient permissions to execute retries (DATA_IMPORT_EXECUTE required)');
        }
        const startTime = Date.now();
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import job with ID '${importId}' not found`);
        }
        const provider = this.targetRegistry.getProvider(importJob.targetEntity);
        if (!provider) {
            throw new Error(`Target writer provider not registered for entity '${importJob.targetEntity}'`);
        }
        const maxRetries = options.maxRetries || 3;
        // Fetch all currently failed records
        const staged = await this.recordRepository.findByImportId(context.organizationId, importId, { status: RecordStatus.FAILED, limit: 100000 });
        let candidates = staged.data;
        if (options.recordIds && options.recordIds.length > 0) {
            const allowedSet = new Set(options.recordIds);
            candidates = candidates.filter((r) => allowedSet.has(r.id));
        }
        // Filter by retryability and attempt count unless forceRetryAll is true
        const eligibleRecords = candidates.filter((r) => {
            const currentAttempts = r.retryCount || 0;
            if (currentAttempts >= maxRetries)
                return false;
            if (options.forceRetryAll)
                return true;
            const retryability = this.reportingService.evaluateRetryability(r.errorCode || '');
            return retryability === 'RETRYABLE';
        });
        if (eligibleRecords.length === 0) {
            throw new ValidationError('No eligible retryable records found for retry execution');
        }
        let newlySucceeded = 0;
        let stillFailing = 0;
        const modifiedRecords = [];
        for (const record of eligibleRecords) {
            const currentAttempts = (record.retryCount || 0) + 1;
            record.retryCount = currentAttempts;
            const payload = record.transformedData || record.rawData;
            const action = record.executionAction || ExecutionIntentAction.CREATE;
            try {
                if (action === ExecutionIntentAction.CREATE) {
                    const createResult = await provider.createRecord(context.organizationId, payload);
                    record.status = RecordStatus.CREATED;
                    record.targetRecordId = createResult.id;
                    record.errorMessage = null;
                    record.errorCode = null;
                    newlySucceeded++;
                }
                else if (action === ExecutionIntentAction.UPDATE) {
                    if (!record.targetRecordId) {
                        throw new Error('Target record ID required for UPDATE action');
                    }
                    await provider.updateRecord(context.organizationId, record.targetRecordId, payload);
                    record.status = RecordStatus.UPDATED;
                    record.errorMessage = null;
                    record.errorCode = null;
                    newlySucceeded++;
                }
            }
            catch (err) {
                record.status = RecordStatus.FAILED;
                record.errorMessage = err.message || 'Retry execution failed';
                record.errorCode = err.code || 'RETRY_EXECUTION_ERROR';
                stillFailing++;
            }
            record.updatedAt = new Date();
            modifiedRecords.push(record);
        }
        await this.recordRepository.saveBatch(modifiedRecords);
        // Re-run post-execution reconciliation
        const reconResult = await this.reconciliationService.reconcileImport(context, importId);
        const durationMs = Date.now() - startTime;
        // Metrics & Audit Logging
        this.metrics.increment('records_retried_total', eligibleRecords.length);
        this.metrics.increment('records_retried_success_total', newlySucceeded);
        this.metrics.recordDuration('retry_duration_ms', durationMs);
        await this.auditServiceInstance.recordEvent({
            organizationId: context.organizationId,
            importId,
            actorUserId: context.userId,
            action: 'IMPORT_RETRY_EXECUTED',
            details: {
                recordsRetried: eligibleRecords.length,
                newlySucceeded,
                stillFailing,
                reconciliationStatus: reconResult.status,
                durationMs
            }
        });
        this.logger.info('Import retry executed', {
            importId,
            retried: eligibleRecords.length,
            newlySucceeded,
            stillFailing,
            reconciliationStatus: reconResult.status,
            durationMs
        });
        return {
            importId,
            retryAttempt: 1,
            recordsRetried: eligibleRecords.length,
            newlySucceeded,
            stillFailing,
            reconciliationStatus: reconResult.status,
            completedAt: new Date(),
            durationMs
        };
    }
}
//# sourceMappingURL=retry.service.js.map