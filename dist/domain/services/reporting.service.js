/**
 * Final Reporting & Export Domain Service with CSV Formula Injection Defense
 */
import { RecordStatus } from '../../core/types/import.types.js';
import { MatchClassification, ExecutionIntentAction } from '../../core/types/duplicate.types.js';
import { ReconciliationStatus } from '../../core/types/reconciliation.types.js';
import { hasPermission, DataImportPermission } from '../../core/types/permissions.types.js';
import { NotFoundError, ForbiddenError } from '../../core/errors/import.errors.js';
import { buildDocxDocument, buildPdfSummaryDocument } from '../../infrastructure/utils/document-export.js';
export class ReportingService {
    importRepository;
    recordRepository;
    executionRepository;
    reconciliationRepository;
    constructor(importRepository, recordRepository, executionRepository, reconciliationRepository) {
        this.importRepository = importRepository;
        this.recordRepository = recordRepository;
        this.executionRepository = executionRepository;
        this.reconciliationRepository = reconciliationRepository;
    }
    /**
     * Generates comprehensive 5-tier final import report
     */
    async getFinalReport(context, importId) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
            throw new ForbiddenError('Insufficient permissions to view import report');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import job with ID '${importId}' not found`);
        }
        const latestExecution = await this.executionRepository.findByImportId(context.organizationId, importId);
        const latestReconciliation = await this.reconciliationRepository.findByImportId(context.organizationId, importId);
        const staged = await this.recordRepository.findByImportId(context.organizationId, importId, { limit: 100000 });
        let parsedRows = staged.pagination.total;
        let validRows = 0;
        let invalidRows = 0;
        let warningRows = 0;
        let correctedRows = 0;
        let newRecords = 0;
        let existingRecords = 0;
        let duplicateInFile = 0;
        let duplicateRows = 0;
        let conflicts = 0;
        let unresolved = 0;
        let created = 0;
        let updated = 0;
        let skipped = 0;
        let rejected = 0;
        let blocked = 0;
        let failed = 0;
        const errorCounts = {};
        let retryableCount = 0;
        let nonRetryableCount = 0;
        for (const r of staged.data) {
            if (r.status === RecordStatus.VALID)
                validRows++;
            else if (r.status === RecordStatus.INVALID)
                invalidRows++;
            else if (r.status === RecordStatus.WARNING)
                warningRows++;
            if (Object.keys(r.transformationAudit || {}).length > 0)
                correctedRows++;
            if (r.isDuplicate || r.matchClassification === MatchClassification.DUPLICATE_IN_FILE)
                duplicateRows++;
            if (r.matchClassification === MatchClassification.NEW)
                newRecords++;
            else if (r.matchClassification === MatchClassification.EXISTING)
                existingRecords++;
            else if (r.matchClassification === MatchClassification.DUPLICATE_IN_FILE)
                duplicateInFile++;
            else if (r.matchClassification === MatchClassification.CONFLICT)
                conflicts++;
            else if (r.matchClassification === MatchClassification.UNRESOLVED)
                unresolved++;
            if (r.status === RecordStatus.CREATED)
                created++;
            else if (r.status === RecordStatus.UPDATED)
                updated++;
            else if (r.status === RecordStatus.SKIPPED)
                skipped++;
            else if (r.status === RecordStatus.REJECTED && r.executionAction === ExecutionIntentAction.REJECT)
                rejected++;
            else if (r.status === RecordStatus.REJECTED || r.status === RecordStatus.INVALID)
                blocked++;
            else if (r.status === RecordStatus.FAILED) {
                failed++;
                const code = r.errorCode || 'UNKNOWN_ERROR';
                errorCounts[code] = (errorCounts[code] || 0) + 1;
                const retryable = this.evaluateRetryability(code);
                if (retryable === 'RETRYABLE')
                    retryableCount++;
                else
                    nonRetryableCount++;
            }
        }
        const durationMs = importJob.completedAt && importJob.startedAt
            ? importJob.completedAt.getTime() - importJob.startedAt.getTime()
            : importJob.updatedAt.getTime() - importJob.createdAt.getTime();
        // Validation is an immutable stage-level source of truth. Matching and
        // execution intentionally change staged-record statuses (VALID ->
        // READY_FOR_IMPORT/CREATED/UPDATED/etc.), so counting only current record
        // statuses here would make later wizard steps incorrectly show 0 valid rows.
        const validationSnapshot = importJob.fileMetadata?.validationSummary;
        const topErrorCodes = Object.entries(errorCounts)
            .map(([code, count]) => ({ code, count }))
            .sort((a, b) => b.count - a.count);
        const mismatchCount = latestReconciliation?.mismatchCount || 0;
        const mismatches = latestReconciliation?.mismatches || [];
        const mismatchSummaryMap = {};
        for (const m of mismatches) {
            mismatchSummaryMap[m.type] = (mismatchSummaryMap[m.type] || 0) + 1;
        }
        return {
            importInfo: {
                importId: importJob.id,
                organizationId: importJob.organizationId,
                name: importJob.name,
                targetModule: importJob.targetModule,
                targetEntity: importJob.targetEntity,
                status: importJob.status,
                createdBy: importJob.createdBy,
                createdAt: importJob.createdAt,
                startedAt: importJob.startedAt,
                completedAt: importJob.completedAt,
                durationMs,
                version: importJob.version
            },
            processing: {
                totalRows: Number(validationSnapshot?.totalRows ?? importJob.fileMetadata?.rowCount ?? (parsedRows > 0 ? parsedRows : importJob.totalRecords)),
                columnCount: Number(importJob.fileMetadata?.columnCount || importJob.fileMetadata?.headers?.length || 0),
                correctedRows,
                parsedRows,
                validRows: Number(validationSnapshot?.validRows ?? importJob.validRecords ?? validRows),
                invalidRows: Number(validationSnapshot?.invalidRows ?? importJob.invalidRecords ?? invalidRows),
                warningRows: Number(validationSnapshot?.warningRows ?? importJob.warningRecords ?? warningRows)
            },
            matching: {
                newRecords,
                existingRecords,
                duplicateInFile,
                duplicateRows,
                conflicts,
                unresolved
            },
            execution: {
                executionId: latestExecution?.id,
                status: latestExecution?.status,
                totalAttempted: created + updated + failed,
                created: created,
                updated: updated,
                skipped: skipped,
                rejected,
                blocked: blocked,
                failed: latestExecution?.recordsFailed ?? failed,
                retryCount: 0
            },
            reconciliation: {
                status: latestReconciliation?.status || ReconciliationStatus.PARTIALLY_RECONCILED,
                isFullyReconciled: latestReconciliation ? latestReconciliation.isFullyReconciled() : false,
                mismatchCount,
                varianceCount: latestReconciliation?.varianceCount || 0,
                sourceRows: latestReconciliation?.plannedRecords || Number(importJob.totalRecords || parsedRows),
                accountedRows: latestReconciliation
                    ? latestReconciliation.createdRecords + latestReconciliation.updatedRecords +
                        latestReconciliation.skippedRecords + latestReconciliation.rejectedRecords +
                        latestReconciliation.blockedRecords + latestReconciliation.failedRecords
                    : created + updated + skipped + rejected + blocked + failed,
                affectedRows: (latestReconciliation?.mismatches || []).map(mismatch => ({
                    rowIndex: mismatch.rowIndex,
                    message: 'This row needs review because its final outcome could not be confirmed.'
                })),
                mismatchesSummary: Object.entries(mismatchSummaryMap).map(([type, count]) => ({
                    type: type,
                    count
                }))
            },
            performance: {
                totalDurationMs: durationMs,
                executionDurationMs: latestExecution?.durationMs ?? undefined,
                reconciliationDurationMs: latestReconciliation?.durationMs
            },
            failedRecordsSummary: {
                totalFailed: failed,
                retryableCount,
                nonRetryableCount,
                topErrorCodes
            },
            approval: {
                status: String(importJob.fileMetadata?.approvalRouting?.decision ||
                    (importJob.fileMetadata?.approvalRouting ? 'PENDING' : 'NOT_REQUIRED')),
                approverLabel: importJob.fileMetadata?.approvalRouting?.approverLabel,
                assignedApproverRole: importJob.fileMetadata?.approvalRouting?.assignedApproverRole,
                submittedBy: importJob.fileMetadata?.approvalRouting?.submittedBy,
                submittedAt: importJob.fileMetadata?.approvalRouting?.submittedAt,
                decidedBy: importJob.fileMetadata?.approvalRouting?.decidedBy,
                decidedByRole: importJob.fileMetadata?.approvalRouting?.decidedByRole,
                decidedAt: importJob.fileMetadata?.approvalRouting?.decidedAt,
                reason: importJob.fileMetadata?.approvalRouting?.reason
            }
        };
    }
    /**
     * Retrieves paginated failed records with categorized error codes & retryability status
     */
    async getFailedRecords(context, importId, query = {}) {
        if (!hasPermission(context, DataImportPermission.DATA_IMPORT_VIEW)) {
            throw new ForbiddenError('Insufficient permissions to view failed records');
        }
        const importJob = await this.importRepository.findById(context.organizationId, importId);
        if (!importJob) {
            throw new NotFoundError(`Import job with ID '${importId}' not found`);
        }
        const page = query.page || 1;
        const limit = query.limit || 50;
        const staged = await this.recordRepository.findByImportId(context.organizationId, importId, {
            status: RecordStatus.FAILED,
            page: 1,
            limit: 100000
        });
        let failedItems = staged.data.map((r) => {
            const errorCode = r.errorCode || 'UNKNOWN_ERROR';
            const errorCategory = this.categorizeError(errorCode);
            const retryability = this.evaluateRetryability(errorCode);
            const maxRetries = 3;
            const retryCount = r.retryCount || 0;
            return {
                id: r.id,
                rowIndex: r.rowIndex,
                rawData: r.rawData,
                transformedData: r.transformedData,
                plannedAction: r.executionAction || ExecutionIntentAction.CREATE,
                status: r.status,
                errorCode,
                errorMessage: r.errorMessage || 'Record execution failed',
                errorCategory,
                retryability,
                retryCount,
                maxRetries,
                isRetryable: retryability === 'RETRYABLE' && retryCount < maxRetries,
                lastAttemptedAt: r.updatedAt
            };
        });
        if (query.category) {
            failedItems = failedItems.filter((i) => i.errorCategory === query.category);
        }
        if (query.retryability) {
            failedItems = failedItems.filter((i) => i.retryability === query.retryability);
        }
        if (query.errorCode) {
            failedItems = failedItems.filter((i) => i.errorCode === query.errorCode);
        }
        const total = failedItems.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const paginated = failedItems.slice(startIndex, startIndex + limit);
        return {
            data: paginated,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        };
    }
    /**
     * Generates downloadable report or CSV export with CSV Formula Injection Defense
     */
    async exportReport(context, importId, format = 'csv') {
        const report = await this.getFinalReport(context, importId);
        const importDate = report.importInfo.createdAt ? report.importInfo.createdAt.toISOString() : '—';
        const completedDate = report.importInfo.completedAt ? report.importInfo.completedAt.toISOString() : '—';
        if (format === 'json') {
            return {
                contentType: 'application/json',
                filename: `import_report_${importId}.json`,
                content: JSON.stringify(report, null, 2)
            };
        }
        const summarySections = [
            {
                heading: 'Import Overview',
                rows: [
                    ['Import ID', report.importInfo.importId],
                    ['Import Name', report.importInfo.name],
                    ['Module', report.importInfo.targetModule],
                    ['Entity', report.importInfo.targetEntity],
                    ['Status', String(report.importInfo.status)],
                    ['Created', importDate],
                    ['Completed', completedDate]
                ]
            },
            {
                heading: 'Dataset & Data Quality',
                rows: [
                    ['Source Rows', report.processing.totalRows.toLocaleString()],
                    ['Source Columns', report.processing.columnCount.toLocaleString()],
                    ['Parsed Rows', report.processing.parsedRows.toLocaleString()],
                    ['Valid Rows', report.processing.validRows.toLocaleString()],
                    ['Warning Rows', report.processing.warningRows.toLocaleString()],
                    ['Invalid Rows', report.processing.invalidRows.toLocaleString()],
                    ['Corrected Rows', report.processing.correctedRows.toLocaleString()],
                    ['Duplicate Rows', report.matching.duplicateRows.toLocaleString()]
                ]
            },
            {
                heading: 'Matching & Execution',
                rows: [
                    ['New Records', report.matching.newRecords.toLocaleString()],
                    ['Existing Matches', report.matching.existingRecords.toLocaleString()],
                    ['In-file Duplicates', report.matching.duplicateInFile.toLocaleString()],
                    ['Conflicts', report.matching.conflicts.toLocaleString()],
                    ['Unresolved Matches', report.matching.unresolved.toLocaleString()],
                    ['Inserted', report.execution.created.toLocaleString()],
                    ['Updated', report.execution.updated.toLocaleString()],
                    ['Skipped', report.execution.skipped.toLocaleString()],
                    ['Blocked', report.execution.blocked.toLocaleString()],
                    ['Failed', report.execution.failed.toLocaleString()]
                ]
            },
            {
                heading: 'Reconciliation & Performance',
                rows: [
                    ['Reconciliation', String(report.reconciliation.status)],
                    ['Variance', report.reconciliation.mismatchCount.toLocaleString()],
                    ['Fully Reconciled', report.reconciliation.isFullyReconciled ? 'YES' : 'NO'],
                    ['Total Duration', `${report.performance.totalDurationMs ?? 0} ms`],
                    ['Execution Duration', report.performance.executionDurationMs == null ? '—' : `${report.performance.executionDurationMs} ms`],
                    ['Failed Records', report.failedRecordsSummary.totalFailed.toLocaleString()],
                    ['Retryable Failures', report.failedRecordsSummary.retryableCount.toLocaleString()],
                    ['Non-retryable Failures', report.failedRecordsSummary.nonRetryableCount.toLocaleString()]
                ]
            }
        ];
        if (format === 'pdf') {
            return {
                contentType: 'application/pdf',
                filename: `import_report_${importId}.pdf`,
                content: buildPdfSummaryDocument('BOSS Data Import Centre — Final Import Report', summarySections)
            };
        }
        if (format === 'docx') {
            return {
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                filename: `import_report_${importId}.docx`,
                content: buildDocxDocument('BOSS Data Import Centre — Final Import Report', summarySections)
            };
        }
        const rows = [];
        rows.push('Section,Metric,Value');
        for (const section of summarySections) {
            for (const [metric, value] of section.rows) {
                rows.push(`${this.sanitizeCsvField(section.heading)},${this.sanitizeCsvField(metric)},${this.sanitizeCsvField(value)}`);
            }
        }
        return {
            contentType: 'text/csv',
            filename: `import_report_${importId}.csv`,
            content: rows.join('\n')
        };
    }
    /**
     * Generates downloadable CSV of failed records with Formula Injection Defense
     */
    async exportFailedRecordsCsv(context, importId) {
        const failedRecords = await this.getFailedRecords(context, importId, { limit: 100000 });
        const headers = ['Row', 'Record ID', 'Action', 'Status', 'Error Code', 'Error Message', 'Category', 'Retryable'];
        const rows = [headers.join(',')];
        for (const item of failedRecords.data) {
            const line = [
                item.rowIndex,
                this.sanitizeCsvField(item.id),
                this.sanitizeCsvField(item.plannedAction),
                this.sanitizeCsvField(item.status),
                this.sanitizeCsvField(item.errorCode),
                this.sanitizeCsvField(item.errorMessage),
                this.sanitizeCsvField(item.errorCategory),
                item.isRetryable ? 'YES' : 'NO'
            ].join(',');
            rows.push(line);
        }
        return {
            contentType: 'text/csv',
            filename: `failed_records_${importId}.csv`,
            content: rows.join('\n')
        };
    }
    /**
     * Defensive CSV Formula Injection Sanitizer
     * Escapes dangerous formula prefixes: =, +, -, @, \t, \r
     */
    sanitizeCsvField(value) {
        if (value === null || value === undefined)
            return '';
        let str = String(value);
        // Check for formula trigger prefix
        if (/^[=+\-@\t\r]/.test(str)) {
            str = `'${str}`;
        }
        // Escape quotes and wrap in quotes if contains commas or newlines
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }
    categorizeError(code) {
        if (code.startsWith('VAL_'))
            return 'VALIDATION_ERROR';
        if (code.startsWith('MAP_'))
            return 'MAPPING_ERROR';
        if (code.startsWith('MATCH_'))
            return 'MATCH_ERROR';
        if (code.startsWith('AUTH_'))
            return 'AUTHORIZATION_ERROR';
        if (code.includes('NOT_FOUND'))
            return 'TARGET_NOT_FOUND';
        if (code.includes('CONSTRAINT') || code.includes('UNIQUE'))
            return 'CONSTRAINT_ERROR';
        if (code.includes('CONFLICT') || code.includes('LOCK'))
            return 'CONFLICT_ERROR';
        if (code.includes('TIMEOUT') || code.includes('TRANSIENT') || code.includes('CONN'))
            return 'TRANSIENT_ERROR';
        return 'SYSTEM_ERROR';
    }
    evaluateRetryability(code) {
        const category = this.categorizeError(code);
        if (category === 'TRANSIENT_ERROR' || category === 'CONFLICT_ERROR') {
            return 'RETRYABLE';
        }
        if (category === 'VALIDATION_ERROR' ||
            category === 'MAPPING_ERROR' ||
            category === 'CONSTRAINT_ERROR' ||
            category === 'AUTHORIZATION_ERROR') {
            return 'NON_RETRYABLE';
        }
        return 'UNKNOWN';
    }
}
//# sourceMappingURL=reporting.service.js.map