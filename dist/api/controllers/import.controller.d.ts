/**
 * Data Import HTTP Controller
 */
import { Request, Response, NextFunction } from 'express';
import { ImportService } from '../../domain/services/import.service.js';
import { FileIngestionService } from '../../domain/services/file-ingestion.service.js';
import { MappingService } from '../../domain/services/mapping.service.js';
import { ValidationService } from '../../domain/services/validation.service.js';
import { DuplicateService } from '../../domain/services/duplicate.service.js';
import { ApprovalService } from '../../domain/services/approval.service.js';
import { ReviewService } from '../../domain/services/review.service.js';
import { ExecutionService } from '../../domain/services/execution.service.js';
import { ReconciliationService } from '../../domain/services/reconciliation.service.js';
import { ReportingService } from '../../domain/services/reporting.service.js';
import { RetryService } from '../../domain/services/retry.service.js';
import { MetricsService } from '../../domain/services/metrics.service.js';
import { IEntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { IAuditService } from '../../domain/services/audit.service.interface.js';
import { ITemplateService } from '../../domain/services/template.service.js';
import { CleanedDataExportService } from '../../domain/services/cleaned-export.service.js';
export declare class ImportController {
    private readonly importService;
    private readonly fileIngestionService?;
    private readonly mappingService?;
    private readonly schemaRegistry?;
    private readonly validationService?;
    private readonly duplicateService?;
    private readonly approvalService?;
    private readonly reviewService?;
    private readonly executionService?;
    private readonly reconciliationService?;
    private readonly reportingService?;
    private readonly retryService?;
    private readonly metricsService?;
    private readonly auditService?;
    private readonly templateService?;
    private readonly cleanedExportService?;
    constructor(importService: ImportService, fileIngestionService?: FileIngestionService | undefined, mappingService?: MappingService | undefined, schemaRegistry?: IEntitySchemaRegistry | undefined, validationService?: ValidationService | undefined, duplicateService?: DuplicateService | undefined, approvalService?: ApprovalService | undefined, reviewService?: ReviewService | undefined, executionService?: ExecutionService | undefined, reconciliationService?: ReconciliationService | undefined, reportingService?: ReportingService | undefined, retryService?: RetryService | undefined, metricsService?: MetricsService | undefined, auditService?: IAuditService | undefined, templateService?: ITemplateService | undefined, cleanedExportService?: CleanedDataExportService | undefined);
    /**
     * GET /data-imports/:id/audit
     * Returns the real persisted/in-memory audit trail for an import.
     */
    getAuditTrail: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports
     * Creates a draft import job
     */
    create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports
     * Lists imports for the tenant with filtering and pagination
     */
    list: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id
     * Retrieves an import by ID
     */
    getById: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/workflow-summary
     * Returns one authoritative statistics snapshot for every wizard step.
     * The frontend must use this endpoint instead of maintaining independent
     * counters per screen. Validation counters come from the persisted validation
     * snapshot; matching/execution/reconciliation counters come from their
     * respective backend services/report.
     */
    getWorkflowSummary: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PATCH /data-imports/:id
     * Updates an import draft
     */
    update: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/save-draft
     * Persists the current wizard progress as a resumable draft.
     */
    saveDraft: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/cancel
     * Cancels an import job using the state machine
     */
    cancel: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/revert-step
     * Rollback changes of the current step and restore last saved state.
     */
    revertStep: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/upload
     * Uploads and secures a file for the import job
     */
    upload: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/parse
     * Parses the stored file and returns normalized rows and preview dataset
     */
    parse: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/entities
     * Discovers all available importable entities in the registry
     */
    listEntities: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/entities/:entity
     * Retrieves detailed schema for a specific importable entity
     */
    getEntityDetails: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/entities/:entity/template
     * Retrieves template metadata for an entity
     */
    getTemplateMetadata: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/entities/:entity/template/download
     * Downloads generated import template file (CSV or XLSX)
     */
    downloadTemplate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/mapping/suggestions
     * Generates automatic mapping suggestions based on parsed headers and entity schema
     */
    getMappingSuggestions: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/mapping
     * Retrieves current saved column mapping definition and validation status
     */
    getMapping: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/mapping
     * Saves or updates column mapping and transitions state to MAPPED / MAPPING
     */
    saveMapping: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/mapping/validate
     * Validates a candidate mapping against entity schema without persisting
     */
    validateMapping: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * DELETE /data-imports/:id/mapping
     * Clears saved mapping configuration and reverts status to PARSED
     */
    clearMapping: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/validate
     * Executes multi-tier validation on mapped dataset and stages records
     */
    validate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/validation-summary
     * Returns authoritative backend validation counters and workflow state.
     */
    getValidationSummary: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/validation-preview
     * Returns paginated staged records and pagination metadata
     */
    getValidationPreview: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PATCH /data-imports/:id/records/:recordId/correct
     * Applies user record correction, re-transforms, re-validates, and updates staged record & import statistics
     */
    correctRecord: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/records/bulk-correct
     * Applies bulk correction across matching staged records, re-validating affected rows
     */
    bulkCorrectRecords: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/detect-duplicates
     * Evaluates intra-file duplicates and target matches, calculating execution intents
     */
    detectDuplicates: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/resolve-duplicate-record
     * Sets duplicate resolution action for a specific record
     */
    resolveDuplicateRecord: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/match-preview
     * Returns paginated matching results, classifications, and execution intents
     */
    getMatchPreview: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/review
     * Evaluates and returns server-side review summary and readiness checklist
     */
    getReviewSummary: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/review/records
     * Returns paginated review records with filter options
     */
    getReviewRecords: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/review/records/:recordId
     * Returns detailed single record inspection with before/after comparisons
     */
    getRecordDetail: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/approve
     * Approves an import job for execution
     */
    approve: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/submit-approval
     * Submits an import to the alternate business role selected by its policy.
     */
    submitApproval: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/reject
     * Rejects an import job
     */
    reject: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/execute
     * Executes batch transactional execution of the approved/validated import
     */
    execute: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/execution
     * Returns execution status and summary metrics
     */
    getExecutionStatus: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/report
     * Returns final reconciled import report
     */
    getFinalReport: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/reconcile
     * Triggers post-execution reconciliation
     */
    reconcile: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/report/export
     * Exports final report as CSV or JSON stream
     */
    exportReport: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/failed-records
     * Returns paginated failed records with error codes and retryability
     */
    getFailedRecords: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /data-imports/:id/failed-records/export
     * Exports failed records CSV with formula injection defense
     */
    exportFailedRecords: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/retry
     * Safely retries eligible failed records
     */
    retryFailedRecords: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /data-imports/:id/export-cleaned
     * Exports final cleaned dataset or rejected records in CSV, XLSX, PDF, or DOCX format
     */
    exportCleanedDataset: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /metrics
     * Returns operational metrics
     */
    getMetrics: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=import.controller.d.ts.map