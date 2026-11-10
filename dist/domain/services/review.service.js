/**
 * Data Import Review Domain Service
 */
import { entitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { DataImportPermission, hasPermission } from '../../core/types/permissions.types.js';
import { ReviewReadiness } from '../../core/types/execution.types.js';
import { RecordStatus, ApprovalStatus } from '../../core/types/import.types.js';
import { NotFoundError, ForbiddenError } from '../../core/errors/import.errors.js';
import { MatchClassification, ExecutionIntentAction } from '../../core/types/duplicate.types.js';
export class ReviewService {
    importRepository;
    mappingRepository;
    recordRepository;
    approvalService;
    schemaRegistry;
    constructor(importRepository, mappingRepository, recordRepository, approvalService, schemaRegistry = entitySchemaRegistry) {
        this.importRepository = importRepository;
        this.mappingRepository = mappingRepository;
        this.recordRepository = recordRepository;
        this.approvalService = approvalService;
        this.schemaRegistry = schemaRegistry;
    }
    /**
     * Generates authoritative server-side review summary and readiness checklist
     */
    async getReviewSummary(context, importId) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
            throw new ForbiddenError('Insufficient permissions to view import review');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import job with ID '${importId}' not found`);
        }
        const mapping = await this.mappingRepository.findByImportId(context.organizationId, importId);
        const stagedRecords = await this.recordRepository.findByImportId(context.organizationId, importId, {
            limit: 100000
        });
        const latestApproval = await this.approvalService.getLatestApproval(context.organizationId, importId);
        const policyResult = await this.approvalService.evaluateApprovalPolicy(context.organizationId, importId);
        const schema = this.schemaRegistry.getEntity(importJob.targetEntity);
        const requiredFields = this.schemaRegistry.getRequiredFields(importJob.targetEntity);
        const excludedFromActionableIssues = (record) => record.executionAction === ExecutionIntentAction.SKIP ||
            record.executionAction === ExecutionIntentAction.REJECT;
        const unresolvedValidationRecords = stagedRecords.data.filter((record) => !excludedFromActionableIssues(record) &&
            (record.status === RecordStatus.INVALID || record.hasErrors()));
        const duplicateDetectionComplete = stagedRecords.data.length > 0 &&
            stagedRecords.data.every((record) => record.matchClassification !== null);
        const unresolvedDuplicateRecords = stagedRecords.data.filter((record) => [MatchClassification.DUPLICATE_IN_FILE, MatchClassification.MULTIPLE_MATCH].includes(record.matchClassification) &&
            [ExecutionIntentAction.REVIEW, ExecutionIntentAction.BLOCKED].includes(record.executionAction));
        const unresolvedActionRecords = stagedRecords.data.filter((record) => !excludedFromActionableIssues(record) &&
            [ExecutionIntentAction.REVIEW, ExecutionIntentAction.BLOCKED].includes(record.executionAction) &&
            !(record.status !== RecordStatus.INVALID &&
                !(Array.isArray(record.validationErrors) && record.validationErrors.some((e) => String(e.severity || 'ERROR').toUpperCase() === 'ERROR')) &&
                (record.blockedReason === 'Validation errors present' || String(record.executionReason || '').includes('validation errors'))));
        const unresolvedValidationIds = new Set(unresolvedValidationRecords.map((record) => record.id));
        const unresolvedDuplicateRecordIds = new Set(unresolvedDuplicateRecords.map((record) => record.id));
        const unresolvedBlockingRecords = unresolvedActionRecords.filter((record) => !unresolvedValidationIds.has(record.id) && !unresolvedDuplicateRecordIds.has(record.id));
        const describeRecordActions = (records, limit = 3) => {
            const details = records.slice(0, limit).map((record) => {
                const reason = record.blockedReason || record.executionReason;
                return `row ${record.rowIndex}${reason ? ` (${reason})` : ''}`;
            });
            return `${details.join('; ')}${records.length > limit ? `; and ${records.length - limit} more` : ''}`;
        };
        const itemsNeedingReview = new Set([
            ...unresolvedValidationRecords.map((record) => record.id),
            ...unresolvedActionRecords.map((record) => record.id)
        ]).size;
        // Compute Checklist Items
        const checklist = [];
        const blockingIssues = [];
        // 1. File Parsed
        const fileParsed = stagedRecords.data.length > 0 || importJob.totalRecords > 0;
        checklist.push({
            code: 'FILE_PARSED',
            title: 'File ready',
            passed: fileParsed,
            blocking: true,
            message: fileParsed ? `File is ready with ${stagedRecords.data.length} rows` : 'Upload a file to continue'
        });
        if (!fileParsed)
            blockingIssues.push('File parsing is incomplete');
        // 2. Mapping Completed
        const mappingCompleted = !!mapping && Object.keys(mapping.columnMappings || {}).length > 0;
        checklist.push({
            code: 'MAPPING_CONFIGURED',
            title: 'Fields mapped',
            passed: mappingCompleted,
            blocking: true,
            message: mappingCompleted ? 'Source fields are connected to the target fields' : 'Map the source fields before continuing'
        });
        if (!mappingCompleted)
            blockingIssues.push('Column mapping is missing');
        // 3. Required Fields Complete
        const mappedTargets = new Set(Object.values(mapping?.columnMappings || {}).map((m) => m.targetField));
        const unmappedRequired = requiredFields.filter((f) => !mappedTargets.has(f));
        const requiredMapped = unmappedRequired.length === 0;
        const requiredFieldNames = new Set(requiredFields);
        const requiredValueErrors = unresolvedValidationRecords.filter((record) => record.validationErrors.some((issue) => issue.severity === 'ERROR' && requiredFieldNames.has(issue.field))).length;
        const requiredFieldsComplete = requiredMapped && requiredValueErrors === 0;
        checklist.push({
            code: 'REQUIRED_FIELDS_MAPPED',
            title: 'Required fields complete',
            passed: requiredFieldsComplete,
            blocking: true,
            message: !requiredMapped
                ? `Map the required fields: ${unmappedRequired.join(', ')}`
                : requiredValueErrors > 0
                    ? `${requiredValueErrors} records have unresolved required-field errors`
                    : 'All required fields are mapped and populated'
        });
        if (!requiredMapped)
            blockingIssues.push(`Missing mandatory field mappings: ${unmappedRequired.join(', ')}`);
        // 4. Validation Completed
        const validationRan = stagedRecords.data.length > 0 &&
            stagedRecords.data.every((r) => r.transformedData !== null);
        checklist.push({
            code: 'VALIDATION_COMPLETED',
            title: 'Data validation complete',
            passed: validationRan,
            blocking: true,
            message: validationRan ? 'Data checks are complete' : 'Run the data checks before continuing'
        });
        if (!validationRan)
            blockingIssues.push('Validation has not been executed');
        const invalidRecordsCount = unresolvedValidationRecords.length;
        if (invalidRecordsCount > 0) {
            blockingIssues.push(`${invalidRecordsCount} records have unresolved validation errors`);
        }
        // 5. Duplicate Detection Completed
        checklist.push({
            code: 'DUPLICATE_DETECTION_COMPLETED',
            title: 'Duplicate review complete',
            passed: duplicateDetectionComplete && unresolvedDuplicateRecords.length === 0,
            blocking: true,
            message: !duplicateDetectionComplete
                ? 'Run duplicate detection before continuing'
                : unresolvedDuplicateRecords.length > 0
                    ? `${unresolvedDuplicateRecords.length} duplicate records still require action: ${describeRecordActions(unresolvedDuplicateRecords)}`
                    : 'No unresolved duplicate records'
        });
        if (!duplicateDetectionComplete)
            blockingIssues.push('Duplicate detection has not been executed');
        if (unresolvedDuplicateRecords.length > 0) {
            blockingIssues.push(`${unresolvedDuplicateRecords.length} duplicate records still require action`);
        }
        // 6. No Blocking Issues
        const conflictCount = stagedRecords.data.filter((r) => r.matchClassification === MatchClassification.MULTIPLE_MATCH).length;
        const noUnresolvedMatches = itemsNeedingReview === 0 && blockingIssues.length === 0;
        const issueReasons = [
            invalidRecordsCount > 0 ? `${invalidRecordsCount} validation errors` : '',
            unresolvedDuplicateRecords.length > 0
                ? `${unresolvedDuplicateRecords.length} unresolved duplicates (${describeRecordActions(unresolvedDuplicateRecords)})`
                : '',
            unresolvedBlockingRecords.length > 0
                ? `${unresolvedBlockingRecords.length} other blocking issues (${describeRecordActions(unresolvedBlockingRecords)})`
                : ''
        ].filter(Boolean);
        checklist.push({
            code: 'NO_BLOCKING_CONFLICTS',
            title: 'No unresolved blocking issues',
            passed: noUnresolvedMatches,
            blocking: true,
            message: noUnresolvedMatches
                ? 'All records are ready for import'
                : itemsNeedingReview > 0
                    ? `${itemsNeedingReview} records still require action${issueReasons.length ? `: ${issueReasons.join(', ')}` : ''}`
                    : blockingIssues.join('; ')
        });
        if (unresolvedBlockingRecords.length > 0) {
            blockingIssues.push(`${unresolvedBlockingRecords.length} records have unresolved blocking issues`);
        }
        // Approval is an explicit workflow step, not an unresolved data issue.
        const approvalRequired = policyResult.requiresApproval;
        const isApproved = latestApproval?.isApproved() ?? false;
        const approvalPending = latestApproval?.isPending() ?? false;
        // Determine Overall Readiness
        let readiness = ReviewReadiness.READY;
        if (blockingIssues.length > 0) {
            readiness = ReviewReadiness.BLOCKED;
        }
        else if (!fileParsed || !mappingCompleted || !requiredFieldsComplete ||
            !validationRan || !duplicateDetectionComplete) {
            readiness = ReviewReadiness.NOT_READY;
        }
        // Counts Aggregation. Validation counts are persisted at validation time
        // because duplicate matching and execution deliberately change record status.
        // Never recalculate the validation totals from the current post-match status.
        const validationSnapshot = importJob.fileMetadata?.validationSummary;
        const totalRecords = Number(stagedRecords.pagination.total ?? validationSnapshot?.totalRows ?? importJob.totalRecords);
        const validRecords = Number(validationSnapshot?.validRows ?? importJob.validRecords ?? 0);
        const warningRecords = Number(validationSnapshot?.warningRows ?? importJob.warningRecords ?? 0);
        const newRecords = stagedRecords.data.filter((r) => r.matchClassification === MatchClassification.NEW).length;
        const existingRecords = stagedRecords.data.filter((r) => r.matchClassification === MatchClassification.EXISTING).length;
        const duplicateRecords = stagedRecords.data.filter((r) => r.isDuplicate).length;
        const conflictRecords = conflictCount;
        const unresolvedRecords = stagedRecords.data.filter((r) => r.matchClassification === MatchClassification.UNRESOLVED &&
            !excludedFromActionableIssues(r)).length;
        const isImportable = (record) => !record.isBlocked && !record.hasErrors() && record.status !== RecordStatus.INVALID;
        const plannedCreates = stagedRecords.data.filter((r) => r.executionAction === ExecutionIntentAction.CREATE && isImportable(r)).length;
        const plannedUpdates = stagedRecords.data.filter((r) => r.executionAction === ExecutionIntentAction.UPDATE && isImportable(r)).length;
        const plannedSkips = stagedRecords.data.filter((r) => r.executionAction === ExecutionIntentAction.SKIP).length;
        const plannedRejected = stagedRecords.data.filter((r) => r.executionAction === ExecutionIntentAction.REJECT).length;
        const plannedBlocked = stagedRecords.data.filter((r) => r.executionAction === ExecutionIntentAction.BLOCKED || r.executionAction === ExecutionIntentAction.REVIEW).length;
        const plannedFailed = stagedRecords.data.filter((r) => r.status === RecordStatus.FAILED).length;
        const readinessLabel = readiness !== ReviewReadiness.READY
            ? 'ACTION REQUIRED'
            : approvalRequired && !isApproved
                ? 'READY FOR APPROVAL'
                : 'READY FOR IMPORT';
        return {
            importId,
            importName: importJob.name,
            department: importJob.targetModule,
            fileName: importJob.fileName,
            targetEntity: importJob.targetEntity,
            readiness,
            readinessLabel,
            status: importJob.status,
            totalRecords,
            validRecords,
            warningRecords,
            invalidRecords: invalidRecordsCount,
            newRecords,
            existingRecords,
            duplicateRecords,
            conflictRecords,
            unresolvedRecords,
            plannedCreates,
            plannedUpdates,
            plannedSkips,
            plannedBlocked,
            plannedRejected,
            plannedFailed,
            unresolvedValidationErrors: invalidRecordsCount,
            unresolvedDuplicates: unresolvedDuplicateRecords.length,
            unresolvedBlockingIssues: unresolvedBlockingRecords.length,
            itemsNeedingReview,
            requiresApproval: approvalRequired,
            approvalStatus: latestApproval?.decision || ApprovalStatus.NOT_REQUIRED,
            approverLabel: latestApproval?.assignedApproverRole
                ? latestApproval.assignedApproverRole.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
                : policyResult.approverLabel,
            assignedApproverRole: latestApproval?.assignedApproverRole || null,
            submittedBy: latestApproval?.requestedBy || null,
            rejectionReason: latestApproval?.isRejected() ? latestApproval.reason : null,
            approvalDetails: latestApproval
                ? {
                    approvedBy: latestApproval.decidedBy,
                    approvedByRole: latestApproval.decidedByRole,
                    approvedAt: latestApproval.decidedAt ? latestApproval.decidedAt.toISOString() : null,
                    requestedBy: latestApproval.requestedBy,
                    requestedAt: latestApproval.requestedAt.toISOString(),
                    assignedApproverRole: latestApproval.assignedApproverRole,
                    decidedByRole: latestApproval.decidedByRole,
                    reason: latestApproval.reason,
                    snapshotHash: latestApproval.snapshotHash
                }
                : undefined,
            checklist,
            blockingIssues
        };
    }
    /**
     * Retrieves paginated review records
     */
    async getReviewRecords(context, importId, filter = {}) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
            throw new ForbiddenError('Insufficient permissions to view review records');
        }
        const records = await this.recordRepository.findByImportId(context.organizationId, importId, {
            page: filter.page,
            limit: filter.limit,
            status: filter.status,
            classification: filter.classification,
            executionAction: filter.action,
            isBlocked: filter.isBlocked
        });
        const items = records.data.map((r) => ({
            id: r.id,
            rowIndex: r.rowIndex,
            status: r.status,
            classification: r.matchClassification || MatchClassification.UNRESOLVED,
            targetRecordId: r.targetRecordId,
            executionAction: r.executionAction || ExecutionIntentAction.BLOCKED,
            executionReason: r.executionReason,
            isBlocked: r.isBlocked,
            blockedReason: r.blockedReason,
            hasErrors: r.hasErrors(),
            hasWarnings: r.hasWarnings(),
            validationErrorsCount: r.validationErrors.length,
            rawData: r.rawData,
            transformedData: r.transformedData
        }));
        return {
            data: items,
            pagination: records.pagination
        };
    }
    /**
     * Retrieves deep detail for an individual staged record with before/after diffs
     */
    async getRecordDetail(context, importId, recordId) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
            throw new ForbiddenError('Insufficient permissions to view record detail');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import job with ID '${importId}' not found`);
        }
        const allRecords = await this.recordRepository.findByImportId(context.organizationId, importId, {
            limit: 100000
        });
        const record = allRecords.data.find((r) => r.id === recordId || String(r.rowIndex) === recordId);
        if (!record) {
            throw new NotFoundError(`Record with ID '${recordId}' not found in import '${importId}'`);
        }
        const mapping = await this.mappingRepository.findByImportId(context.organizationId, importId);
        const schema = this.schemaRegistry.getEntity(importJob.targetEntity);
        const comparisons = [];
        for (const [sourceHeader, mappingDef] of Object.entries(mapping?.columnMappings || {})) {
            const rawValue = record.rawData[sourceHeader];
            const targetField = mappingDef.targetField;
            const transformedValue = record.transformedData ? record.transformedData[targetField] : undefined;
            const fieldDef = schema?.fields[targetField];
            comparisons.push({
                field: targetField,
                label: fieldDef?.label || targetField,
                sourceHeader,
                rawValue,
                transformedValue,
                hasChanged: String(rawValue) !== String(transformedValue)
            });
        }
        return {
            id: record.id,
            rowIndex: record.rowIndex,
            status: record.status,
            classification: record.matchClassification || MatchClassification.UNRESOLVED,
            targetRecordId: record.targetRecordId,
            executionAction: record.executionAction || ExecutionIntentAction.BLOCKED,
            executionReason: record.executionReason,
            isBlocked: record.isBlocked,
            blockedReason: record.blockedReason,
            hasErrors: record.hasErrors(),
            hasWarnings: record.hasWarnings(),
            validationErrorsCount: record.validationErrors.length,
            rawData: record.rawData,
            transformedData: record.transformedData,
            fieldComparisons: comparisons,
            issues: record.validationErrors
        };
    }
}
//# sourceMappingURL=review.service.js.map