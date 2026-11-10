/**
 * Duplicate Detection and Record Matching Domain Service
 */
import { targetMatchProviderRegistry } from '../../infrastructure/matching/in-memory-target-match.provider.js';
import { entitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { auditService } from '../../infrastructure/services/audit.service.js';
import { StructuredLogger } from '../../core/logging/structured-logger.js';
import { DataImportPermission, hasPermission } from '../../core/types/permissions.types.js';
import { MatchClassification, ExecutionIntentAction } from '../../core/types/duplicate.types.js';
import { ImportStatus, ImportMode, RecordStatus } from '../../core/types/import.types.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../core/errors/import.errors.js';
import { DuplicateDetectionEngine } from '../duplicate/duplicate-detection.engine.js';
import { MatchKeyGenerator } from '../duplicate/match-key.generator.js';
import { ImportStateMachine } from '../state-machine/import-state-machine.js';
export class DuplicateService {
    importRepository;
    recordRepository;
    targetProviderRegistry;
    schemaRegistry;
    auditService;
    logger;
    constructor(importRepository, recordRepository, targetProviderRegistry = targetMatchProviderRegistry, schemaRegistry = entitySchemaRegistry, auditServiceInstance = auditService, logger = new StructuredLogger('DuplicateService')) {
        this.importRepository = importRepository;
        this.recordRepository = recordRepository;
        this.targetProviderRegistry = targetProviderRegistry;
        this.schemaRegistry = schemaRegistry;
        this.auditService = auditServiceInstance;
        this.logger = logger;
    }
    /**
     * Evaluates and classifies duplicate status & execution intent for all staged records.
     * @param overrideStrategy - when provided, supersedes the strategy stored on the import job
     *   for this detection run AND persists it so subsequent execution uses the same strategy.
     */
    async detectDuplicates(context, importId, overrideStrategy) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VALIDATE) &&
            !hasPermission(context, DataImportPermission.DATA_IMPORT_EXECUTE) &&
            !hasPermission(context, DataImportPermission.DATA_IMPORT_CREATE)) {
            throw new ForbiddenError('Insufficient permissions to run duplicate detection');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import job with ID '${importId}' not found`);
        }
        const previousDuplicateSummary = importJob.fileMetadata?.duplicateSummary;
        const stagedRecords = await this.recordRepository.findByImportId(context.organizationId, importId, { limit: 100000 });
        if (stagedRecords.data.length === 0) {
            throw new ValidationError(`No staged records found for import ID '${importId}'`);
        }
        // A draft saved from Duplicate Scan has already passed validation. Permit
        // rescanning it only while every staged record still has validated data;
        // an incomplete draft must return to Validation first.
        const validatedDraft = importJob.status === ImportStatus.DRAFT &&
            stagedRecords.data.every((record) => record.transformedData !== null);
        const allowedDetectionStates = [
            ImportStatus.VALIDATED,
            ImportStatus.VALIDATION_FAILED,
            ImportStatus.MATCHING
        ];
        if (!allowedDetectionStates.includes(importJob.status) && !validatedDraft) {
            throw new ValidationError(`Duplicate detection requires completed validation (current: ${importJob.status}). ` +
                `Ensure validation has passed before running duplicate matching.`);
        }
        // Apply override strategy: persist it so the execution phase also honours the
        // user's selection from Step 5, not the value baked in at import creation time.
        if (overrideStrategy && overrideStrategy !== importJob.importOptions.duplicateStrategy) {
            this.logger.info('Overriding duplicate strategy for detection run', {
                importId,
                previous: importJob.importOptions.duplicateStrategy,
                override: overrideStrategy
            });
            importJob.importOptions = {
                ...importJob.importOptions,
                duplicateStrategy: overrideStrategy
            };
            await this.importRepository.update(importJob);
        }
        const targetProvider = this.targetProviderRegistry.getProvider(importJob.targetEntity);
        // Transition to MATCHING to make clear a read/analysis operation is in progress.
        // This is a transient state; the import transitions back to VALIDATED when done.
        const previousImportStatus = importJob.status;
        if (importJob.status === ImportStatus.VALIDATED) {
            ImportStateMachine.transition(importJob, ImportStatus.MATCHING);
            await this.importRepository.update(importJob);
        }
        this.logger.info('Starting duplicate detection and record matching', {
            importId,
            organizationId: context.organizationId,
            entity: importJob.targetEntity,
            totalRows: stagedRecords.data.length,
            strategy: importJob.importOptions.duplicateStrategy
        });
        const engineResult = await DuplicateDetectionEngine.evaluateDataset(stagedRecords.data, {
            organizationId: context.organizationId,
            entityName: importJob.targetEntity,
            duplicateStrategy: importJob.importOptions.duplicateStrategy,
            importMode: ImportMode.UPSERT,
            targetProvider,
            schemaRegistry: this.schemaRegistry
        });
        // Update staged record entities with matching decisions and execution intents
        for (const record of stagedRecords.data) {
            const isSkippedByUser = String(record.executionReason || '').startsWith('Skipped by user');
            if (isSkippedByUser) {
                record.executionAction = ExecutionIntentAction.SKIP;
                record.status = RecordStatus.SKIPPED_DUPLICATE;
                record.isDuplicate = false;
                record.isBlocked = false;
                record.blockedReason = null;
                record.updatedAt = new Date();
                continue;
            }
            const isRejected = record.executionAction === ExecutionIntentAction.REJECT ||
                record.status === RecordStatus.REJECTED;
            if (isRejected) {
                record.executionAction = ExecutionIntentAction.REJECT;
                record.status = RecordStatus.REJECTED;
                record.isDuplicate = false;
                record.isBlocked = true;
                record.updatedAt = new Date();
                continue;
            }
            const matchRes = engineResult.matchResults.get(record.id);
            const intent = engineResult.intents.get(record.id);
            if (matchRes && intent) {
                const wasUpdatedByUser = String(record.executionReason || '').startsWith('Duplicate values updated');
                if (wasUpdatedByUser && !intent.blocked && [ExecutionIntentAction.CREATE, ExecutionIntentAction.UPDATE].includes(intent.action)) {
                    record.matchClassification = matchRes.classification;
                    record.matchKey = matchRes.matchKey;
                    record.matchKeyHash = matchRes.matchKeyHash;
                    record.targetRecordId = matchRes.matchedTargetId ?? null;
                    record.candidateTargetIds = matchRes.candidateTargetIds ?? [];
                    record.isDuplicate = false;
                    record.executionAction = intent.action;
                    record.executionReason = 'Duplicate values updated, validated, and cleared for import';
                    record.isBlocked = false;
                    record.blockedReason = null;
                    record.status = RecordStatus.READY_FOR_IMPORT;
                    record.updatedAt = new Date();
                    continue;
                }
                const hasUnresolvedConflict = String(record.blockedReason || '').includes('still match') ||
                    String(record.executionReason || '').includes('still match');
                if (hasUnresolvedConflict) {
                    record.matchClassification = matchRes.classification;
                    record.matchKey = matchRes.matchKey;
                    record.matchKeyHash = matchRes.matchKeyHash;
                    record.targetRecordId = matchRes.matchedTargetId ?? null;
                    record.candidateTargetIds = matchRes.candidateTargetIds ?? [];
                    record.isDuplicate = false;
                    record.executionAction = ExecutionIntentAction.REVIEW;
                    record.status = RecordStatus.REQUIRES_REVIEW;
                    record.isBlocked = true;
                    record.updatedAt = new Date();
                    continue;
                }
                record.matchClassification = matchRes.classification;
                record.matchKey = matchRes.matchKey;
                record.matchKeyHash = matchRes.matchKeyHash;
                record.targetRecordId = matchRes.matchedTargetId ?? null;
                record.candidateTargetIds = matchRes.candidateTargetIds ?? [];
                record.isDuplicate =
                    (matchRes.classification === MatchClassification.EXISTING ||
                        matchRes.classification === MatchClassification.DUPLICATE_IN_FILE ||
                        matchRes.classification === MatchClassification.MULTIPLE_MATCH) &&
                        (intent.action === ExecutionIntentAction.REVIEW || intent.action === ExecutionIntentAction.BLOCKED);
                record.duplicateMatchId = matchRes.matchedTargetId ?? null;
                record.executionAction = intent.action;
                record.executionReason = intent.reason;
                record.isBlocked = intent.blocked;
                record.blockedReason = intent.blockedReason ?? null;
                // Assign explicit record processing eligibility state
                if (record.status !== RecordStatus.INVALID) {
                    if (intent.action === ExecutionIntentAction.SKIP) {
                        record.status = RecordStatus.SKIPPED_DUPLICATE;
                    }
                    else if (intent.action === ExecutionIntentAction.REVIEW) {
                        record.status = RecordStatus.REQUIRES_REVIEW;
                    }
                    else if (intent.action === ExecutionIntentAction.BLOCKED) {
                        record.status = RecordStatus.DUPLICATE;
                    }
                    else if ((intent.action === ExecutionIntentAction.CREATE || intent.action === ExecutionIntentAction.UPDATE) && !intent.blocked) {
                        record.status = RecordStatus.READY_FOR_IMPORT;
                    }
                }
                record.updatedAt = new Date();
            }
        }
        // Filter to active groups with unresolved conflicts
        const activeDuplicateGroups = engineResult.summary.duplicateGroups.filter((group) => {
            if (group.isResolved || group.status === 'RESOLVED')
                return false;
            return (group.recordsCount || group.records.length) >= 2;
        });
        for (const group of activeDuplicateGroups) {
            group.status = group.records.every((item) => [ExecutionIntentAction.SKIP, ExecutionIntentAction.REJECT, ExecutionIntentAction.UPDATE, ExecutionIntentAction.CREATE].includes(item.resolutionAction)) ? 'RESOLVED' : 'REQUIRES_RESOLUTION';
        }
        const currentDuplicateRecordIds = new Set(activeDuplicateGroups.flatMap((group) => group.records.map((item) => item.recordId)));
        // Build resolved groups from persisted records
        const resolvedGroups = [];
        let resolvedIndexCounter = 1;
        for (const record of stagedRecords.data) {
            if (currentDuplicateRecordIds.has(record.id))
                continue;
            const isSkippedByUser = String(record.executionReason || '').startsWith('Skipped by user');
            const isUpdatedByUser = String(record.executionReason || '').startsWith('Duplicate values updated');
            if (isSkippedByUser || isUpdatedByUser) {
                const currentData = (record.transformedData || record.rawData || {});
                resolvedGroups.push({
                    id: `resolved-${record.id}`,
                    groupIndex: resolvedIndexCounter++,
                    groupKey: record.matchKey || `Row ${record.rowIndex}`,
                    matchKey: record.matchKey || `Row ${record.rowIndex}`,
                    matchKeyHash: record.matchKeyHash || '',
                    type: isSkippedByUser ? 'IN_FILE_DUPLICATE' : (record.targetRecordId ? 'DATABASE_MATCH' : 'IN_FILE_DUPLICATE'),
                    classification: record.matchClassification || MatchClassification.NEW,
                    count: 1,
                    recordsCount: 1,
                    sourceRowNumbers: [record.rowIndex],
                    recordIds: [record.id],
                    primaryRecordId: null,
                    primaryRowNumber: null,
                    matchedTargetId: record.targetRecordId || null,
                    targetRecordData: null,
                    sampleRecordData: currentData,
                    status: 'RESOLVED',
                    isResolved: true,
                    resolutionAction: record.executionAction,
                    resolutionReason: record.executionReason || (isSkippedByUser ? 'Skipped by user during duplicate resolution' : 'Duplicate values updated; record is now unique.'),
                    records: [{
                            recordId: record.id,
                            sourceRowNumber: record.rowIndex,
                            role: 'DUPLICATE',
                            isPrimary: false,
                            data: currentData,
                            matchKey: record.matchKey || '',
                            matchedTargetId: record.targetRecordId || null,
                            targetRecordData: null,
                            resolutionAction: record.executionAction,
                            resolutionReason: record.executionReason || (isSkippedByUser ? 'Skipped by user' : 'Updated by user'),
                            availableActions: []
                        }]
                });
            }
        }
        engineResult.summary.duplicateGroups = activeDuplicateGroups;
        engineResult.summary.resolvedDuplicateGroups = resolvedGroups;
        // Counts come from the current persisted action for every staged record.
        let createsCount = 0;
        let updatesCount = 0;
        let skipsCount = 0;
        let rejectedCount = 0;
        let reviewsCount = 0;
        let blockedCount = 0;
        let resolvedUpdatesCount = 0;
        for (const record of stagedRecords.data) {
            const action = record.executionAction;
            const status = record.status;
            const reason = String(record.executionReason || '');
            if (reason.startsWith('Duplicate values updated')) {
                resolvedUpdatesCount++;
            }
            if (action === ExecutionIntentAction.SKIP ||
                status === RecordStatus.SKIPPED_DUPLICATE ||
                status === RecordStatus.SKIPPED ||
                reason.startsWith('Skipped by user')) {
                skipsCount++;
            }
            else if (action === ExecutionIntentAction.REJECT || status === RecordStatus.REJECTED) {
                rejectedCount++;
                skipsCount++;
            }
            else if (action === ExecutionIntentAction.CREATE && !record.isBlocked) {
                createsCount++;
            }
            else if (action === ExecutionIntentAction.UPDATE && !record.isBlocked) {
                updatesCount++;
            }
            else if (action === ExecutionIntentAction.REVIEW) {
                reviewsCount++;
            }
            else if (action === ExecutionIntentAction.BLOCKED && status !== RecordStatus.INVALID) {
                blockedCount++;
            }
        }
        const inFileDataDuplicates = activeDuplicateGroups.reduce((total, group) => total + group.records.filter((r) => !r.isPrimary && r.role !== 'PRIMARY').length, 0);
        engineResult.summary.creates = createsCount;
        engineResult.summary.newRecords = createsCount;
        engineResult.summary.updates = updatesCount;
        engineResult.summary.existingRecords = updatesCount;
        engineResult.summary.skips = skipsCount;
        engineResult.summary.rejected = rejectedCount;
        engineResult.summary.reviews = reviewsCount;
        engineResult.summary.blocked = blockedCount;
        engineResult.summary.unresolved = reviewsCount + blockedCount;
        engineResult.summary.resolvedUpdates = resolvedUpdatesCount;
        engineResult.summary.duplicateInFile = inFileDataDuplicates;
        engineResult.summary.duplicateRecords = activeDuplicateGroups.reduce((total, group) => total + group.records.length, 0);
        // Persist updated records
        await this.recordRepository.saveBatch(stagedRecords.data);
        // Transition back to VALIDATED: duplicate scan is complete, records are classified.
        // The import is now ready for review/approval/execution.
        // MATCHING → VALIDATED
        if ([ImportStatus.VALIDATED, ImportStatus.MATCHING].includes(previousImportStatus)) {
            ImportStateMachine.transition(importJob, ImportStatus.VALIDATED);
        }
        await this.importRepository.update(importJob);
        importJob.fileMetadata = {
            ...(importJob.fileMetadata || {}),
            duplicateSummary: engineResult.summary,
            duplicateCompletedAt: new Date().toISOString()
        };
        await this.importRepository.update(importJob);
        // Record Audit event
        await this.auditService.recordEvent({
            organizationId: context.organizationId,
            importId,
            actorUserId: context.userId,
            action: 'IMPORT_DUPLICATES_DETECTED',
            details: {
                importId,
                entity: importJob.targetEntity,
                duplicateStrategy: importJob.importOptions.duplicateStrategy,
                summary: {
                    total: engineResult.summary.totalRecords,
                    newRecords: engineResult.summary.newRecords,
                    existingRecords: engineResult.summary.existingRecords,
                    duplicateInFile: engineResult.summary.duplicateInFile,
                    conflicts: engineResult.summary.conflicts,
                    creates: engineResult.summary.creates,
                    updates: engineResult.summary.updates,
                    skips: engineResult.summary.skips,
                    blocked: engineResult.summary.blocked
                }
            }
        });
        this.logger.info('Duplicate detection completed successfully', {
            importId,
            summary: engineResult.summary
        });
        return engineResult.summary;
    }
    /**
  
     * Retrieves paginated, filterable match preview
     */
    async getMatchPreview(context, importId, query) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
            throw new ForbiddenError('Insufficient permissions to view match preview');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import job with ID '${importId}' not found`);
        }
        const recordsResult = await this.recordRepository.findByImportId(context.organizationId, importId, {
            page: query.page,
            limit: query.limit,
            classification: query.classification,
            executionAction: query.action,
            isDuplicate: query.isDuplicate,
            isBlocked: query.isBlocked
        });
        const items = recordsResult.data.map((r) => ({
            id: r.id,
            rowIndex: r.rowIndex,
            status: r.status,
            classification: r.matchClassification || MatchClassification.UNRESOLVED,
            matchKey: r.matchKey,
            matchKeyHash: r.matchKeyHash,
            matchedTargetId: r.targetRecordId || null,
            candidateTargetIds: r.candidateTargetIds || [],
            executionAction: r.executionAction || 'BLOCKED',
            executionReason: r.executionReason || 'No match evaluation performed',
            isBlocked: r.isBlocked,
            blockedReason: r.blockedReason,
            isDuplicate: r.isDuplicate,
            rawData: r.rawData,
            transformedData: r.transformedData,
            issues: r.validationErrors.map((e) => ({
                code: e.code,
                message: e.message,
                severity: e.severity,
                field: e.field
            }))
        }));
        return {
            data: items,
            pagination: recordsResult.pagination
        };
    }
    /**
     * Resolves a specific duplicate record with an action (SKIP, UPDATE, SEND_FOR_REVIEW)
     */
    async resolveRecord(context, importId, recordId, resolutionAction, rejectionReason) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VALIDATE) &&
            !hasPermission(context, DataImportPermission.DATA_IMPORT_CREATE)) {
            throw new ForbiddenError('Insufficient permissions to resolve duplicate records');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import job with ID '${importId}' not found`);
        }
        const record = await this.recordRepository.findById(context.organizationId, recordId);
        if (!record || record.importId !== importId) {
            throw new NotFoundError(`Record with ID '${recordId}' not found in import`);
        }
        let action;
        const duplicateSummary = importJob.fileMetadata?.duplicateSummary;
        const schema = this.schemaRegistry.getEntity(importJob.targetEntity);
        const duplicateRule = schema?.duplicateRules?.find((rule) => rule.isDefault) || schema?.duplicateRules?.[0];
        const currentMatchKey = duplicateRule
            ? MatchKeyGenerator.generateMatchKey(record.transformedData || record.rawData, duplicateRule, schema?.fields)
            : null;
        let updateIssue = null;
        if (resolutionAction === 'UPDATE' || resolutionAction === 'EDIT') {
            if (record.hasErrors() ||
                [RecordStatus.INVALID, RecordStatus.REJECTED, RecordStatus.FAILED].includes(record.status)) {
                updateIssue = 'Correct the validation errors before updating this duplicate.';
            }
            else if (!currentMatchKey) {
                updateIssue = 'The edited record is missing required duplicate key values.';
            }
            else {
                const allRecords = await this.recordRepository.findByImportId(context.organizationId, importId, { limit: 100000 });
                const conflictingRecord = duplicateRule && allRecords.data.find((other) => {
                    const otherReason = String(other.executionReason || '');
                    const isOtherSkipped = other.executionAction === ExecutionIntentAction.SKIP ||
                        other.status === RecordStatus.SKIPPED_DUPLICATE ||
                        other.status === RecordStatus.SKIPPED ||
                        otherReason.startsWith('Skipped by user');
                    const isOtherRejected = other.executionAction === ExecutionIntentAction.REJECT ||
                        other.status === RecordStatus.REJECTED ||
                        otherReason.startsWith('Rejected by user');
                    if (other.id === recordId || isOtherSkipped || isOtherRejected) {
                        return false;
                    }
                    const otherKey = MatchKeyGenerator.generateMatchKey(other.transformedData || other.rawData, duplicateRule, schema?.fields);
                    return otherKey?.hash === currentMatchKey.hash;
                });
                const targetProvider = this.targetProviderRegistry.getProvider(importJob.targetEntity);
                const targetMatches = targetProvider
                    ? await targetProvider.findByMatchKeys(context.organizationId, [currentMatchKey.hash], [currentMatchKey.displayKey])
                    : new Map();
                const matchesExistingTarget = (targetMatches.get(currentMatchKey.hash) || [])
                    .some((target) => target.id !== record.targetRecordId);
                if (conflictingRecord) {
                    updateIssue = `The edited values still match source row ${conflictingRecord.rowIndex}.`;
                }
                else if (matchesExistingTarget && !record.targetRecordId) {
                    updateIssue = 'The edited values still match an existing database record.';
                }
            }
        }
        const updateResolved = ['UPDATE', 'EDIT'].includes(resolutionAction) && !updateIssue;
        if (resolutionAction === 'REJECT') {
            // REJECT: excluded from execution, shown as rejected in final report
            action = ExecutionIntentAction.REJECT;
            record.executionAction = action;
            record.status = RecordStatus.REJECTED;
            record.isBlocked = true;
            record.blockedReason = rejectionReason?.trim() || 'Duplicate rejected by user';
            record.executionReason = rejectionReason?.trim()
                ? `Rejected by user during duplicate resolution: ${rejectionReason.trim()}`
                : 'Rejected by user during duplicate resolution';
        }
        else if (['UPDATE', 'EDIT'].includes(resolutionAction) && !updateResolved) {
            action = ExecutionIntentAction.REVIEW;
            record.executionAction = action;
            record.status = RecordStatus.REQUIRES_REVIEW;
            record.isBlocked = true;
            record.blockedReason = updateIssue;
            record.executionReason = updateIssue;
        }
        else if (resolutionAction === 'UPDATE' || resolutionAction === 'EDIT') {
            // A conflict-free in-file edit becomes a create; matched target rows
            // retain their explicit target update.
            const targetRecordId = record.targetRecordId;
            action = targetRecordId ? ExecutionIntentAction.UPDATE : ExecutionIntentAction.CREATE;
            record.executionAction = action;
            record.status = RecordStatus.READY_FOR_IMPORT;
            record.isBlocked = false;
            record.blockedReason = null;
            record.isDuplicate = false;
            record.matchClassification = targetRecordId ? MatchClassification.EXISTING : MatchClassification.NEW;
            record.matchKey = currentMatchKey?.displayKey || record.matchKey;
            record.matchKeyHash = currentMatchKey?.hash || record.matchKeyHash;
            if (!targetRecordId)
                record.targetRecordId = null;
            record.executionReason = 'Duplicate values updated, validated, and cleared for import';
        }
        else {
            // SKIP: excluded from execution, shown as skipped in final report
            action = ExecutionIntentAction.SKIP;
            record.executionAction = action;
            record.status = RecordStatus.SKIPPED_DUPLICATE;
            record.isBlocked = false;
            record.blockedReason = null;
            record.executionReason = 'Skipped by user during duplicate resolution';
        }
        record.updatedAt = new Date();
        await this.recordRepository.saveBatch([record]);
        // Re-detect duplicates to refresh all partner records and summary metrics in recordRepository
        const refreshedSummary = await this.detectDuplicates(context, importId, importJob.importOptions?.duplicateStrategy || 'SEND_FOR_REVIEW');
        await this.auditService.recordEvent({
            organizationId: context.organizationId,
            importId,
            actorUserId: context.userId,
            action: 'IMPORT_DUPLICATE_RECORD_RESOLVED',
            details: {
                recordId,
                sourceRowNumber: record.rowIndex,
                resolutionAction,
                rejectionReason: resolutionAction === 'REJECT' ? rejectionReason?.trim() || null : null
            }
        });
        return {
            ...refreshedSummary,
            recordResolution: {
                recordId,
                resolved: [ExecutionIntentAction.CREATE, ExecutionIntentAction.UPDATE,
                    ExecutionIntentAction.SKIP, ExecutionIntentAction.REJECT].includes(record.executionAction) &&
                    (record.executionAction === ExecutionIntentAction.REJECT || !record.isBlocked),
                action: record.executionAction || ExecutionIntentAction.BLOCKED,
                reason: record.executionReason
            }
        };
    }
}
//# sourceMappingURL=duplicate.service.js.map