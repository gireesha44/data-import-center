/**
 * Data Import Batch Execution Domain Service
 */
import { randomUUID } from 'node:crypto';
import { inMemoryDataImportExecutionRepository } from '../../infrastructure/repositories/in-memory-data-import-execution.repository.js';
import { targetMatchProviderRegistry } from '../../infrastructure/matching/in-memory-target-match.provider.js';
import { auditService } from '../../infrastructure/services/audit.service.js';
import { StructuredLogger } from '../../core/logging/structured-logger.js';
import { DataImportPermission, hasPermission } from '../../core/types/permissions.types.js';
import { DataImportExecutionEntity } from '../entities/data-import-execution.entity.js';
import { ImportStatus, RecordStatus, ExecutionStatus, ErrorStrategy } from '../../core/types/import.types.js';
import { ExecutionIntentAction } from '../../core/types/duplicate.types.js';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../../core/errors/import.errors.js';
import { ImportStateMachine } from '../state-machine/import-state-machine.js';
export class ExecutionService {
    importRepository;
    recordRepository;
    executionRepository;
    approvalService;
    targetProviderRegistry;
    auditService;
    logger;
    constructor(importRepository, recordRepository, approvalService, executionRepository = inMemoryDataImportExecutionRepository, targetProviderRegistry = targetMatchProviderRegistry, auditServiceInstance = auditService, logger = new StructuredLogger('ExecutionService')) {
        this.importRepository = importRepository;
        this.recordRepository = recordRepository;
        this.approvalService = approvalService;
        this.executionRepository = executionRepository;
        this.targetProviderRegistry = targetProviderRegistry;
        this.auditService = auditServiceInstance;
        this.logger = logger;
    }
    /**
     * Generates immutable execution plan from current staged state
     */
    async generateExecutionPlan(organizationId, importId) {
        const importJob = await this.importRepository.findById(organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import job with ID '${importId}' not found`);
        }
        const stagedRecords = await this.recordRepository.findByImportId(organizationId, importId, {
            limit: 100000
        });
        const snapshotHash = await this.approvalService.computeSnapshotHash(organizationId, importId);
        const items = stagedRecords.data.map((r) => ({
            recordId: r.id,
            rowIndex: r.rowIndex,
            action: r.executionAction || ExecutionIntentAction.BLOCKED,
            targetId: r.targetRecordId,
            payload: r.transformedData || r.rawData,
            isBlocked: r.isBlocked || r.executionAction === ExecutionIntentAction.BLOCKED,
            blockedReason: r.blockedReason
        }));
        return {
            importId,
            organizationId,
            targetEntity: importJob.targetEntity,
            version: importJob.version,
            snapshotHash,
            createdAt: new Date(),
            items
        };
    }
    /**
     * Executes transactional batch execution of staged import records
     */
    async executeImport(context, importId) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_EXECUTE)) {
            throw new ForbiddenError('Insufficient permissions to execute import jobs (DATA_IMPORT_EXECUTE required)');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import job with ID '${importId}' not found`);
        }
        // Concurrency Lock: Prevent multiple concurrent executions
        if (importJob.status === ImportStatus.PROCESSING || importJob.status === ImportStatus.QUEUED) {
            throw new ConflictError('Import job is currently executing or queued');
        }
        // Validate Approval & State Readiness
        const policyResult = await this.approvalService.evaluateApprovalPolicy(context.organizationId, importId);
        const latestApproval = await this.approvalService.getLatestApproval(context.organizationId, importId);
        if (policyResult.requiresApproval) {
            if (!latestApproval || !latestApproval.isApproved()) {
                throw new ValidationError('Import job requires formal approval before execution');
            }
            // Verify approval snapshot hash
            const currentHash = await this.approvalService.computeSnapshotHash(context.organizationId, importId);
            if (latestApproval.snapshotHash !== currentHash) {
                await this.approvalService.invalidateApproval(context.organizationId, importId, 'State modified after approval was granted');
                throw new ValidationError('Approval is stale because mapping, validation, or matching changed after approval. Re-approval required.');
            }
        }
        // Resolve the target adapter BEFORE mutating the import lifecycle.
        // A missing provider is a configuration error, not an execution failure;
        // the import must remain in its current state so the user can fix the
        // configuration and retry. Previously we moved the job to PROCESSING and
        // created an IN_PROGRESS execution record before this lookup, which left
        // the job locked in PROCESSING and made every retry return:
        // `Import job is currently executing or queued`.
        const targetProvider = this.targetProviderRegistry.getProvider(importJob.targetEntity);
        if (!targetProvider) {
            throw new ValidationError(`No target entity provider registered for '${importJob.targetEntity}'. ` +
                `Register a target provider for this entity before starting execution.`);
        }
        // State transition to PROCESSING only after all preflight checks succeed.
        if (ImportStateMachine.canTransition(importJob.status, ImportStatus.QUEUED)) {
            ImportStateMachine.transition(importJob, ImportStatus.QUEUED);
        }
        ImportStateMachine.transition(importJob, ImportStatus.PROCESSING);
        await this.importRepository.update(importJob);
        // Initialize Execution Entity
        const execution = new DataImportExecutionEntity({
            id: `exec_${randomUUID()}`,
            organizationId: context.organizationId,
            importId,
            status: ExecutionStatus.IN_PROGRESS,
            startedAt: new Date(),
            batchSize: importJob.importOptions.batchSize || 500
        });
        await this.executionRepository.create(execution);
        await this.auditService.recordEvent({
            organizationId: context.organizationId,
            importId,
            executionId: execution.id,
            actorUserId: context.userId,
            action: 'IMPORT_EXECUTION_STARTED',
            details: {
                executionId: execution.id,
                targetEntity: importJob.targetEntity,
                totalRecords: importJob.totalRecords
            }
        });
        const stagedRecords = await this.recordRepository.findByImportId(context.organizationId, importId, { limit: 100000 });
        let createsCount = 0;
        let updatesCount = 0;
        let skipsCount = 0;
        let rejectedCount = 0;
        let blockedCount = 0;
        let failsCount = 0;
        const errorSummary = {};
        const batchSize = execution.batchSize;
        const allRows = stagedRecords.data;
        const totalBatches = Math.ceil(allRows.length / batchSize);
        execution.totalBatches = totalBatches;
        const startTime = Date.now();
        const createdTargetIdsByKey = new Map();
        try {
            for (let i = 0; i < allRows.length; i += batchSize) {
                const batch = allRows.slice(i, i + batchSize);
                for (const record of batch) {
                    if (record.executionAction === ExecutionIntentAction.REJECT) {
                        rejectedCount++;
                        record.status = RecordStatus.REJECTED;
                        continue;
                    }
                    // 1. Blocked records
                    if (record.isBlocked ||
                        record.executionAction === ExecutionIntentAction.BLOCKED ||
                        record.executionAction === ExecutionIntentAction.REVIEW) {
                        blockedCount++;
                        record.status = RecordStatus.REJECTED;
                        continue;
                    }
                    // 2. Skip records
                    if (record.executionAction === ExecutionIntentAction.SKIP) {
                        skipsCount++;
                        record.status = RecordStatus.SKIPPED;
                        continue;
                    }
                    // 3. Create records
                    if (record.executionAction === ExecutionIntentAction.CREATE) {
                        try {
                            const payload = record.transformedData || record.rawData;
                            const created = await targetProvider.createRecord(context.organizationId, payload);
                            record.status = RecordStatus.CREATED;
                            record.targetRecordId = created.id;
                            if (record.matchKeyHash)
                                createdTargetIdsByKey.set(record.matchKeyHash, created.id);
                            if (record.matchKey)
                                createdTargetIdsByKey.set(record.matchKey, created.id);
                            createsCount++;
                        }
                        catch (err) {
                            failsCount++;
                            record.status = RecordStatus.FAILED;
                            record.executionError = err.message || 'Target creation failed';
                            const errKey = err.code || 'CREATE_FAILED';
                            errorSummary[errKey] = (errorSummary[errKey] || 0) + 1;
                            if (importJob.importOptions.errorStrategy === ErrorStrategy.ALL_OR_NOTHING) {
                                throw err;
                            }
                        }
                        continue;
                    }
                    // 4. Update records
                    if (record.executionAction === ExecutionIntentAction.UPDATE) {
                        try {
                            const targetId = record.targetRecordId ||
                                (record.matchKeyHash ? createdTargetIdsByKey.get(record.matchKeyHash) : null) ||
                                (record.matchKey ? createdTargetIdsByKey.get(record.matchKey) : null);
                            if (!targetId) {
                                throw new Error('Target record ID missing for UPDATE action');
                            }
                            const payload = record.transformedData || record.rawData;
                            await targetProvider.updateRecord(context.organizationId, targetId, payload);
                            record.targetRecordId = targetId;
                            record.status = RecordStatus.UPDATED;
                            updatesCount++;
                        }
                        catch (err) {
                            failsCount++;
                            record.status = RecordStatus.FAILED;
                            record.executionError = err.message || 'Target update failed';
                            const errKey = err.code || 'UPDATE_FAILED';
                            errorSummary[errKey] = (errorSummary[errKey] || 0) + 1;
                            if (importJob.importOptions.errorStrategy === ErrorStrategy.ALL_OR_NOTHING) {
                                throw err;
                            }
                        }
                    }
                }
                // Save updated staged batch
                await this.recordRepository.saveBatch(batch);
                execution.completedBatches++;
                // Persist live execution progress after every committed chunk so the
                // execution-status endpoint can report real progress while the batch
                // is running. This is not a simulated progress bar.
                await this.executionRepository.update(execution);
            }
            // Finalize Successful Execution
            const durationMs = Date.now() - startTime;
            execution.status = ExecutionStatus.COMPLETED;
            execution.finishedAt = new Date();
            execution.durationMs = durationMs;
            execution.recordsSucceeded = createsCount + updatesCount;
            execution.recordsFailed = failsCount;
            execution.errorSummary = errorSummary;
            await this.executionRepository.update(execution);
            importJob.processedRecords = createsCount + updatesCount;
            importJob.failedRecords = failsCount;
            importJob.skippedRecords = skipsCount + rejectedCount + blockedCount;
            importJob.fileMetadata = {
                ...(importJob.fileMetadata || {}),
                executionSummary: {
                    totalRecords: allRows.length,
                    inserted: createsCount,
                    updated: updatesCount,
                    skipped: skipsCount,
                    rejected: rejectedCount,
                    blocked: blockedCount,
                    failed: failsCount,
                    processed: createsCount + updatesCount,
                    durationMs
                },
                executionCompletedAt: new Date().toISOString()
            };
            const nextStatus = failsCount > 0 ? ImportStatus.COMPLETED_WITH_ERRORS : ImportStatus.COMPLETED;
            ImportStateMachine.transition(importJob, nextStatus);
            await this.importRepository.update(importJob);
            await this.auditService.recordEvent({
                organizationId: context.organizationId,
                importId,
                executionId: execution.id,
                actorUserId: context.userId,
                action: 'IMPORT_EXECUTION_COMPLETED',
                details: {
                    executionId: execution.id,
                    status: nextStatus,
                    creates: createsCount,
                    updates: updatesCount,
                    skips: skipsCount,
                    blocked: blockedCount,
                    fails: failsCount,
                    durationMs
                }
            });
            this.logger.info('Import execution completed', {
                importId,
                executionId: execution.id,
                creates: createsCount,
                updates: updatesCount,
                fails: failsCount
            });
            return this.toSummaryDto(execution, importJob, createsCount, updatesCount, skipsCount, rejectedCount, blockedCount, failsCount, durationMs);
        }
        catch (error) {
            // Abort / Failure Handling
            const durationMs = Date.now() - startTime;
            execution.status = ExecutionStatus.FAILED;
            execution.finishedAt = new Date();
            execution.durationMs = durationMs;
            execution.recordsSucceeded = createsCount + updatesCount;
            execution.recordsFailed = failsCount;
            execution.errorSummary = { ...errorSummary, FATAL_ERROR: error.message };
            await this.executionRepository.update(execution);
            ImportStateMachine.transition(importJob, ImportStatus.FAILED);
            await this.importRepository.update(importJob);
            await this.auditService.recordEvent({
                organizationId: context.organizationId,
                importId,
                executionId: execution.id,
                actorUserId: context.userId,
                action: 'IMPORT_EXECUTION_FAILED',
                details: {
                    executionId: execution.id,
                    error: error.message
                }
            });
            throw error;
        }
    }
    /**
     * Retrieves execution status and metrics
     */
    async getExecutionStatus(context, importId) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
            throw new ForbiddenError('Insufficient permissions to view execution status');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import job with ID '${importId}' not found`);
        }
        const execution = await this.executionRepository.findByImportId(context.organizationId, importId);
        if (!execution) {
            throw new NotFoundError(`No execution records found for import '${importId}'`);
        }
        const staged = await this.recordRepository.findByImportId(context.organizationId, importId, { limit: 100000 });
        const creates = staged.data.filter((r) => r.status === RecordStatus.CREATED).length;
        const updates = staged.data.filter((r) => r.status === RecordStatus.UPDATED).length;
        const skips = staged.data.filter((r) => r.status === RecordStatus.SKIPPED).length;
        const rejected = staged.data.filter((r) => r.executionAction === ExecutionIntentAction.REJECT && r.status === RecordStatus.REJECTED).length;
        const blocked = staged.data.filter((r) => r.status === RecordStatus.REJECTED && r.executionAction !== ExecutionIntentAction.REJECT).length;
        const fails = staged.data.filter((r) => r.status === RecordStatus.FAILED).length;
        const liveDurationMs = execution.durationMs ?? (execution.startedAt ? Math.max(0, Date.now() - execution.startedAt.getTime()) : 0);
        return this.toSummaryDto(execution, importJob, creates, updates, skips, rejected, blocked, fails, liveDurationMs);
    }
    /**
     * Returns structured error summary for failed records
     */
    async getErrorReport(context, importId) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
            throw new ForbiddenError('Insufficient permissions to export error report');
        }
        const staged = await this.recordRepository.findByImportId(context.organizationId, importId, {
            status: RecordStatus.FAILED,
            limit: 50000
        });
        return {
            importId,
            totalErrors: staged.data.length,
            failedRecords: staged.data.map((r) => ({
                sourceRow: r.rowIndex,
                recordId: r.id,
                action: r.executionAction,
                targetRecordId: r.targetRecordId,
                executionError: r.executionError,
                validationIssues: r.validationErrors
            }))
        };
    }
    toSummaryDto(execution, importJob, creates, updates, skips, rejected, blocked, fails, durationMs) {
        return {
            executionId: execution.id,
            importId: execution.importId,
            status: execution.status,
            totalRecords: importJob.totalRecords || creates + updates + skips + rejected + blocked + fails,
            successfulCreates: creates,
            successfulUpdates: updates,
            skippedRecords: skips,
            rejectedRecords: rejected,
            blockedRecords: blocked,
            failedRecords: fails,
            completedBatches: execution.completedBatches,
            totalBatches: execution.totalBatches,
            durationMs,
            startedAt: execution.startedAt ? execution.startedAt.toISOString() : null,
            finishedAt: execution.finishedAt ? execution.finishedAt.toISOString() : null,
            errorSummary: execution.errorSummary
        };
    }
}
//# sourceMappingURL=execution.service.js.map