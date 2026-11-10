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
import {
  createImportRequestSchema,
  updateImportRequestSchema,
  listImportsQuerySchema,
  cancelImportRequestSchema,
  saveDraftRequestSchema,
  parseImportRequestSchema,
  uploadFilePayloadSchema,
  saveMappingRequestSchema,
  validateMappingRequestSchema,
  validateImportRequestSchema,
  validationPreviewQuerySchema,
  bulkCorrectRequestSchema,
  detectDuplicatesRequestSchema,
  matchPreviewQuerySchema,
  approveImportRequestSchema,
  rejectImportRequestSchema,
  reviewRecordsQuerySchema,
  executeImportRequestSchema,
  failedRecordsQuerySchema,
  exportReportQuerySchema,
  retryImportRequestSchema
} from '../validation/import.validation.js';
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError
} from '../../core/errors/import.errors.js';
import { ImportStatus, RecordStatus } from '../../core/types/import.types.js';
import { IAuditService } from '../../domain/services/audit.service.interface.js';
import { ReviewFilterQuery } from '../../core/types/execution.types.js';
import { ITemplateService } from '../../domain/services/template.service.js';
import { CleanedDataExportService } from '../../domain/services/cleaned-export.service.js';

export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly fileIngestionService?: FileIngestionService,
    private readonly mappingService?: MappingService,
    private readonly schemaRegistry?: IEntitySchemaRegistry,
    private readonly validationService?: ValidationService,
    private readonly duplicateService?: DuplicateService,
    private readonly approvalService?: ApprovalService,
    private readonly reviewService?: ReviewService,
    private readonly executionService?: ExecutionService,
    private readonly reconciliationService?: ReconciliationService,
    private readonly reportingService?: ReportingService,
    private readonly retryService?: RetryService,
    private readonly metricsService?: MetricsService,
    private readonly auditService?: IAuditService,
    private readonly templateService?: ITemplateService,
    private readonly cleanedExportService?: CleanedDataExportService
  ) {}

  /**
   * GET /data-imports/:id/audit
   * Returns the real persisted/in-memory audit trail for an import.
   */
  public getAuditTrail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.auditService) {
        throw new NotFoundError('Audit service is not configured');
      }

      const importId = req.params.id;
      const importItem = await this.importService.getImport(req.securityContext, importId);
      const logs = await this.auditService.getImportAuditTrail(
        req.securityContext.organizationId,
        importItem.id
      );

      res.status(200).json({
        success: true,
        data: logs.map((log) => log.toJSON())
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports
   * Creates a draft import job
   */
  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();

      const validatedInput = createImportRequestSchema.parse(req.body);
      const result = await this.importService.createImport(req.securityContext, validatedInput);

      res.status(201).json({
        success: true,
        data: result.toJSON()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports
   * Lists imports for the tenant with filtering and pagination
   */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();

      const validatedQuery = listImportsQuerySchema.parse(req.query);
      const result = await this.importService.listImports(req.securityContext, validatedQuery);

      res.status(200).json({
        success: true,
        data: result.data.map((item) => item.toJSON()),
        meta: {
          pagination: result.pagination
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id
   * Retrieves an import by ID
   */
  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();

      const importId = req.params.id;
      const result = await this.importService.getImport(req.securityContext, importId);

      res.status(200).json({
        success: true,
        data: result.toJSON()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/workflow-summary
   * Returns one authoritative statistics snapshot for every wizard step.
   * The frontend must use this endpoint instead of maintaining independent
   * counters per screen. Validation counters come from the persisted validation
   * snapshot; matching/execution/reconciliation counters come from their
   * respective backend services/report.
   */
  public getWorkflowSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();

      const importId = req.params.id;
      const importJob = await this.importService.getImport(req.securityContext, importId);
      const validationSnapshot = importJob.fileMetadata?.validationSummary || {};
      let duplicateSnapshot = importJob.fileMetadata?.duplicateSummary || {};
      let executionSnapshot = importJob.fileMetadata?.executionSummary || {};

      // Backward-compatible recovery for imports created before the compact
      // cross-step snapshots were introduced. New imports never take this path.
      let legacyReport: any = null;
      if ((Object.keys(duplicateSnapshot).length === 0 || Object.keys(executionSnapshot).length === 0) && this.reportingService) {
        try {
          legacyReport = await this.reportingService.getFinalReport(req.securityContext, importId);
          if (Object.keys(duplicateSnapshot).length === 0) {
            duplicateSnapshot = {
              newRecords: legacyReport.matching?.newRecords ?? 0,
              existingRecords: legacyReport.matching?.existingRecords ?? 0,
              duplicateInFile: legacyReport.matching?.duplicateInFile ?? 0,
              duplicateInTarget: legacyReport.matching?.existingRecords ?? 0,
              creates: 0,
              updates: 0,
              skips: legacyReport.execution?.skipped ?? 0,
              blocked: legacyReport.execution?.blocked ?? 0
            };
          }
          if (Object.keys(executionSnapshot).length === 0 && legacyReport.execution) {
            executionSnapshot = {
              inserted: legacyReport.execution.created ?? 0,
              updated: legacyReport.execution.updated ?? 0,
              skipped: legacyReport.execution.skipped ?? 0,
              blocked: legacyReport.execution.blocked ?? 0,
              failed: legacyReport.execution.failed ?? 0,
              processed: (legacyReport.execution.created ?? 0) + (legacyReport.execution.updated ?? 0),
              durationMs: legacyReport.performance?.executionDurationMs ?? 0
            };
          }
        } catch (_) {}
      }

      let validation: any = null;
      if (this.validationService) {
        try {
          validation = await this.validationService.getValidationSummary(req.securityContext, importId);
        } catch (_) {}
      }

      let reconciliation: any = null;
      if (this.reconciliationService) {
        try {
          reconciliation = await this.reconciliationService.getLatestReconciliation(
            req.securityContext.organizationId,
            importId
          );
        } catch (_) {}
      }

      const totalRows = Number(
        validationSnapshot.totalRows ??
        importJob.fileMetadata?.rowCount ??
        importJob.totalRecords ??
        0
      );
      const columnCount = Number(
        importJob.fileMetadata?.columnCount ??
        importJob.fileMetadata?.headers?.length ??
        0
      );
      // Before validation runs, these values are not known. Returning 0 here is
      // misleading because 0 means "known zero", not "not evaluated yet".
      // Preserve the distinction so the UI can render an em dash until the real
      // validation snapshot exists. Once validation has run, the persisted
      // snapshot remains the sole source of truth.
      const hasValidationSnapshot = Object.keys(validationSnapshot).length > 0;
      const validRows = hasValidationSnapshot
        ? Number(validationSnapshot.validRows ?? 0)
        : null;
      const warningRows = hasValidationSnapshot
        ? Number(validationSnapshot.warningRows ?? 0)
        : null;
      const invalidRows = hasValidationSnapshot
        ? Number(validationSnapshot.invalidRows ?? 0)
        : null;
      const correctedRows = hasValidationSnapshot
        ? Number(validationSnapshot.correctedRows ?? 0)
        : null;

      const insertedRows = Number(executionSnapshot.inserted ?? importJob.fileMetadata?.executionSummary?.inserted ?? 0);
      const updatedRows = Number(executionSnapshot.updated ?? importJob.fileMetadata?.executionSummary?.updated ?? 0);
      const skippedRows = Number(executionSnapshot.skipped ?? 0);
      const rejectedRows = Number(executionSnapshot.rejected ?? 0);
      const blockedRows = Number(executionSnapshot.blocked ?? 0);
      const failedRows = Number(executionSnapshot.failed ?? importJob.failedRecords ?? 0);
      const processedRows = Number(executionSnapshot.processed ?? importJob.processedRecords ?? 0);
      const remainingRows = Math.max(totalRows - (processedRows + skippedRows + rejectedRows + blockedRows + failedRows), 0);

      res.status(200).json({
        success: true,
        data: {
          importId,
          state: importJob.status,
          step: validation?.step,
          rows: {
            total: totalRows,
            valid: validRows,
            warnings: warningRows,
            invalid: invalidRows,
            corrected: correctedRows,
            duplicates: Number(duplicateSnapshot.duplicateInFile ?? 0) + Number(duplicateSnapshot.duplicateInTarget ?? 0),
            newRecords: Number(duplicateSnapshot.newRecords ?? 0),
            matchedRecords: Number(duplicateSnapshot.existingRecords ?? 0),
            inserted: insertedRows,
            updated: updatedRows,
            skipped: skippedRows,
            rejected: rejectedRows,
            blocked: blockedRows,
            failed: failedRows,
            processed: processedRows,
            remaining: remainingRows
          },
          planned: {
            inserts: Number(duplicateSnapshot.creates ?? 0),
            updates: Number(duplicateSnapshot.updates ?? 0),
            skips: Number(duplicateSnapshot.skips ?? 0),
            rejected: Number(duplicateSnapshot.rejected ?? 0),
            blocked: Number(duplicateSnapshot.blocked ?? 0),
            unresolved: Number(duplicateSnapshot.unresolved ?? (Number(duplicateSnapshot.reviews ?? 0) + Number(duplicateSnapshot.blocked ?? 0)))
          },
          columns: columnCount,
          execution: Object.keys(executionSnapshot).length > 0
            ? {
                status: importJob.status === 'COMPLETED_WITH_ERRORS' ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
                completedBatches: undefined,
                totalBatches: undefined,
                durationMs: Number(executionSnapshot.durationMs ?? 0)
              }
            : null,
          reconciliation: reconciliation
            ? {
                sourceRows: reconciliation.sourceRows,
                sourceColumns: reconciliation.sourceColumns,
                validatedRows: reconciliation.validatedRows,
                warningRows: reconciliation.warningRows,
                invalidRows: reconciliation.invalidRows,
                correctedRows: reconciliation.correctedRows,
                duplicateRows: reconciliation.duplicateRows,
                createdRecords: reconciliation.createdRecords,
                updatedRecords: reconciliation.updatedRecords,
                skippedRecords: reconciliation.skippedRecords,
                rejectedRecords: reconciliation.rejectedRecords,
                blockedRecords: reconciliation.blockedRecords,
                failedRecords: reconciliation.failedRecords,
                varianceCount: reconciliation.varianceCount,
                mismatchCount: reconciliation.mismatchCount,
                status: reconciliation.status
              }
            : null
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /data-imports/:id
   * Updates an import draft
   */
  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();

      const importId = req.params.id;
      const validatedInput = updateImportRequestSchema.parse(req.body);
      const result = await this.importService.updateImport(
        req.securityContext,
        importId,
        validatedInput
      );

      res.status(200).json({
        success: true,
        data: result.toJSON()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/save-draft
   * Persists the current wizard progress as a resumable draft.
   */
  public saveDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      const importId = req.params.id;
      const input = saveDraftRequestSchema.parse(req.body || {});
      const result = await this.importService.saveDraft(req.securityContext, importId, input.currentStep);
      res.status(200).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/cancel
   * Cancels an import job using the state machine
   */
  public cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();

      const importId = req.params.id;
      const validatedInput = cancelImportRequestSchema.parse(req.body);
      const result = await this.importService.cancelImport(
        req.securityContext,
        importId,
        validatedInput.reason
      );

      res.status(200).json({
        success: true,
        data: result.toJSON()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/revert-step
   * Rollback changes of the current step and restore last saved state.
   */
  public revertStep = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      const importId = req.params.id;
      const { step } = req.body;
      
      await this.importService.revertStep(req.securityContext, importId, step);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/upload
   * Uploads and secures a file for the import job
   */
  public upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.fileIngestionService) {
        throw new Error('FileIngestionService not configured');
      }

      const importId = req.params.id;
      let filename: string;
      let buffer: Buffer;
      let mimeType: string | undefined;

      if (req.file) {
        filename = req.file.originalname;
        buffer = req.file.buffer;
        mimeType = req.file.mimetype;
      } else if (req.body && typeof req.body === 'object' && 'filename' in req.body) {
        const parsed = uploadFilePayloadSchema.parse(req.body);
        filename = parsed.filename;
        buffer =
          parsed.encoding === 'base64'
            ? Buffer.from(parsed.content, 'base64')
            : Buffer.from(parsed.content, 'utf-8');
        mimeType = parsed.mimeType;
      } else {
        throw new ValidationError('No file was attached or provided in request body');
      }

      const result = await this.fileIngestionService.uploadFile(
        req.securityContext,
        importId,
        filename,
        buffer,
        mimeType
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/parse
   * Parses the stored file and returns normalized rows and preview dataset
   */
  public parse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.fileIngestionService) {
        throw new Error('FileIngestionService not configured');
      }

      const importId = req.params.id;
      const validatedOptions = parseImportRequestSchema.parse(req.body || {});

      const result = await this.fileIngestionService.parseFile(
        req.securityContext,
        importId,
        validatedOptions
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/entities
   * Discovers all available importable entities in the registry
   */
  public listEntities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.schemaRegistry) {
        throw new Error('EntitySchemaRegistry not configured');
      }

      const entities = this.schemaRegistry.listEntities().map((e) => ({
        module: e.module,
        entity: e.entity,
        displayName: e.displayName,
        description: e.description,
        version: e.version,
        fields: e.fields,
        duplicateRules: e.duplicateRules,
        approvalPolicy: e.approvalPolicy,
        fieldsCount: Object.keys(e.fields).length,
        requiredFields: Object.values(e.fields).filter((f) => f.required && !f.readOnly).map((f) => f.name)
      }));

      res.status(200).json({
        success: true,
        data: entities
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/entities/:entity
   * Retrieves detailed schema for a specific importable entity
   */
  public getEntityDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.schemaRegistry) {
        throw new Error('EntitySchemaRegistry not configured');
      }

      const entityName = req.params.entity;
      const schema = this.schemaRegistry.getEntity(entityName);
      if (!schema) {
        throw new NotFoundError(`Entity '${entityName}' is not registered in Schema Registry`);
      }

      res.status(200).json({
        success: true,
        data: schema
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/entities/:entity/template
   * Retrieves template metadata for an entity
   */
  public getTemplateMetadata = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.templateService) {
        throw new Error('TemplateService not configured');
      }

      const entityName = req.params.entity;
      const metadata = this.templateService.getTemplateMetadata(entityName);

      res.status(200).json({
        success: true,
        data: metadata
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/entities/:entity/template/download
   * Downloads generated import template file (CSV or XLSX)
   */
  public downloadTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.templateService) {
        throw new Error('TemplateService not configured');
      }

      const entityName = req.params.entity;
      const format = (req.query.format as string || 'csv').toLowerCase();

      if (format === 'xlsx') {
        const buffer = this.templateService.generateXlsxTemplate(entityName);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${entityName}_import_template.xlsx"`);
        res.status(200).send(buffer);
      } else {
        const csvContent = this.templateService.generateCsvTemplate(entityName);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${entityName}_import_template.csv"`);
        res.status(200).send(csvContent);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/mapping/suggestions
   * Generates automatic mapping suggestions based on parsed headers and entity schema
   */
  public getMappingSuggestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.mappingService) {
        throw new Error('MappingService not configured');
      }

      const importId = req.params.id;
      const result = await this.mappingService.getSuggestions(req.securityContext, importId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/mapping
   * Retrieves current saved column mapping definition and validation status
   */
  public getMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.mappingService) {
        throw new Error('MappingService not configured');
      }

      const importId = req.params.id;
      const result = await this.mappingService.getMapping(req.securityContext, importId);

      if (!result.mapping) {
        res.status(200).json({
          success: true,
          data: null
        });
        return;
      }

      const job = await this.importService.getImport(req.securityContext, importId);
      res.status(200).json({
        success: true,
        data: {
          ...result.mapping.toJSON(),
          validation: result.validation,
          workflow: {
            jobId: job.id,
            state: job.status,
            step: job.status === ImportStatus.MAPPED ? 3 : 3,
            nextAllowedAction: job.status === ImportStatus.MAPPED ? 'RUN_VALIDATION' : 'SAVE_MAPPING'
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/mapping
   * Saves or updates column mapping and transitions state to MAPPED / MAPPING
   */
  public saveMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.mappingService) {
        throw new Error('MappingService not configured');
      }

      const importId = req.params.id;
      const validatedInput = saveMappingRequestSchema.parse(req.body);

      const result = await this.mappingService.saveMapping(
        req.securityContext,
        importId,
        validatedInput
      );

      res.status(200).json({
        success: true,
        data: {
          ...result.mapping.toJSON(),
          validation: result.validation
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/mapping/validate
   * Validates a candidate mapping against entity schema without persisting
   */
  public validateMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.mappingService) {
        throw new Error('MappingService not configured');
      }

      const importId = req.params.id;
      const validatedInput = validateMappingRequestSchema.parse(req.body || {});

      const result = await this.mappingService.validateMapping(
        req.securityContext,
        importId,
        validatedInput
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /data-imports/:id/mapping
   * Clears saved mapping configuration and reverts status to PARSED
   */
  public clearMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.mappingService) {
        throw new Error('MappingService not configured');
      }

      const importId = req.params.id;
      await this.mappingService.clearMapping(req.securityContext, importId);

      res.status(200).json({
        success: true,
        message: 'Mapping cleared successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/validate
   * Executes multi-tier validation on mapped dataset and stages records
   */
  public validate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.validationService) {
        throw new Error('ValidationService not configured');
      }

      const importId = req.params.id;
      validateImportRequestSchema.parse(req.body || {});

      const result = await this.validationService.validateImport(
        req.securityContext,
        importId
      );
      const workflow = await this.validationService.getValidationSummary(
        req.securityContext,
        importId
      );

      // Preserve the existing validation summary shape while adding the
      // authoritative backend state so the frontend cannot remain visually in
      // MAPPING after the backend has moved to VALIDATED/VALIDATION_FAILED.
      res.status(200).json({
        success: true,
        data: {
          ...result,
          workflow: {
            jobId: importId,
            state: workflow.status,
            step: workflow.step,
            nextAllowedAction: workflow.nextAllowedAction,
            canProceedToMatching: workflow.canProceedToMatching
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/validation-summary
   * Returns authoritative backend validation counters and workflow state.
   */
  public getValidationSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.validationService) throw new Error('ValidationService not configured');

      const result = await this.validationService.getValidationSummary(
        req.securityContext,
        req.params.id
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/validation-preview
   * Returns paginated staged records and pagination metadata
   */
  public getValidationPreview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.validationService) {
        throw new Error('ValidationService not configured');
      }

      const importId = req.params.id;
      const query = validationPreviewQuerySchema.parse(req.query);

      const result = await this.validationService.getValidationPreview(
        req.securityContext,
        importId,
        {
          status: query.status as RecordStatus | undefined,
          page: query.page,
          limit: query.limit,
          errorCode: query.errorCode,
          column: query.column,
          search: query.search,
          requiresAction: query.requiresAction
        }
      );

      const summary = await this.validationService.getValidationSummary(
        req.securityContext,
        importId
      );

      res.status(200).json({
        success: true,
        data: result.data.map((r) => r.toJSON()),
        meta: {
          pagination: result.pagination,
          validation: summary.summary,
          workflow: {
            jobId: importId,
            state: summary.status,
            step: summary.step,
            nextAllowedAction: summary.nextAllowedAction,
            canProceedToMatching: summary.canProceedToMatching
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /data-imports/:id/records/:recordId/correct
   * Applies user record correction, re-transforms, re-validates, and updates staged record & import statistics
   */
  public correctRecord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.validationService) {
        throw new Error('ValidationService not configured');
      }

      const importId = req.params.id;
      const recordId = req.params.recordId;
      const { field, newValue, fields } = req.body || {};

      const hasFieldBatch = fields && typeof fields === 'object' && !Array.isArray(fields) && Object.keys(fields).length > 0;
      if (!hasFieldBatch && (!field || typeof field !== 'string')) {
        throw new ValidationError('Field name is required for record correction');
      }

      const result = hasFieldBatch
        ? await this.validationService.correctRecordFields(req.securityContext, importId, recordId, fields)
        : await this.validationService.correctRecord(req.securityContext, importId, recordId, field, newValue);
      let duplicateSummary;
      const updatedImport = await this.importService.getImport(req.securityContext, importId);
      if (
        this.duplicateService &&
        updatedImport.fileMetadata?.duplicateSummary &&
        [ImportStatus.VALIDATED, ImportStatus.VALIDATION_FAILED].includes(updatedImport.status)
      ) {
        duplicateSummary = await this.duplicateService.detectDuplicates(req.securityContext, importId);
      }

      res.status(200).json({
        success: true,
        data: {
          record: result.record.toJSON(),
          summary: result.summary,
          duplicateSummary
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/records/bulk-correct
   * Applies bulk correction across matching staged records, re-validating affected rows
   */
  public bulkCorrectRecords = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.validationService) {
        throw new Error('ValidationService not configured');
      }

      const importId = req.params.id;
      const payload = bulkCorrectRequestSchema.parse(req.body || {});

      const result = await this.validationService.bulkCorrectRecords(
        req.securityContext,
        importId,
        payload.field,
        payload.oldValue,
        payload.newValue,
        payload.errorCode
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/detect-duplicates
   * Evaluates intra-file duplicates and target matches, calculating execution intents
   */
  public detectDuplicates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.duplicateService) {
        throw new Error('DuplicateService not configured');
      }

      const importId = req.params.id;
      // Parse and honour the overrideStrategy sent by the frontend (Step 5 dropdown).
      // Previously this was parsed but never forwarded to the service, causing the
      // detection engine to always use the strategy from import creation time (SKIP).
      const { overrideStrategy } = detectDuplicatesRequestSchema.parse(req.body || {});

      const result = await this.duplicateService.detectDuplicates(
        req.securityContext,
        importId,
        overrideStrategy
      );
      const job = await this.importService.getImport(req.securityContext, importId);

      res.status(200).json({
        success: true,
        data: {
          ...result,
          workflow: {
            jobId: job.id,
            state: job.status,
            step: job.status === ImportStatus.VALIDATED ? 5 : 5,
            nextAllowedAction: job.status === ImportStatus.VALIDATED ? 'REVIEW' : 'WAIT_FOR_CURRENT_OPERATION'
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/resolve-duplicate-record
   * Sets duplicate resolution action for a specific record
   */
  public resolveDuplicateRecord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.duplicateService) {
        throw new Error('DuplicateService not configured');
      }

      const importId = req.params.id;
      const { recordId, action, rejectionReason } = req.body;
      if (!recordId || !action) {
        throw new ValidationError('recordId and action are required');
      }
      if (typeof rejectionReason === 'string' && rejectionReason.length > 1000) {
        throw new ValidationError('Rejection reason must be 1000 characters or fewer');
      }

      const resolution = await this.duplicateService.resolveRecord(
        req.securityContext,
        importId,
        recordId,
        action,
        typeof rejectionReason === 'string' ? rejectionReason : undefined
      );
      const summary = await this.duplicateService.detectDuplicates(req.securityContext, importId);

      res.status(200).json({
        success: true,
        data: {
          ...summary,
          recordResolution: resolution.recordResolution
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/match-preview
   * Returns paginated matching results, classifications, and execution intents
   */
  public getMatchPreview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.duplicateService) {
        throw new Error('DuplicateService not configured');
      }

      const importId = req.params.id;
      const query = matchPreviewQuerySchema.parse(req.query);

      const result = await this.duplicateService.getMatchPreview(
        req.securityContext,
        importId,
        query
      );

      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          pagination: result.pagination
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/review
   * Evaluates and returns server-side review summary and readiness checklist
   */
  public getReviewSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.reviewService) throw new Error('ReviewService not configured');

      const importId = req.params.id;
      const result = await this.reviewService.getReviewSummary(req.securityContext, importId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/review/records
   * Returns paginated review records with filter options
   */
  public getReviewRecords = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.reviewService) throw new Error('ReviewService not configured');

      const importId = req.params.id;
      const parsed = reviewRecordsQuerySchema.parse(req.query);
      const query: ReviewFilterQuery = {
        page: parsed.page,
        limit: parsed.limit,
        status: parsed.status,
        classification: parsed.classification,
        action: parsed.action,
        isBlocked: parsed.isBlocked
      };

      const result = await this.reviewService.getReviewRecords(
        req.securityContext,
        importId,
        query
      );

      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          pagination: result.pagination
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/review/records/:recordId
   * Returns detailed single record inspection with before/after comparisons
   */
  public getRecordDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.reviewService) throw new Error('ReviewService not configured');

      const importId = req.params.id;
      const recordId = req.params.recordId;
      const result = await this.reviewService.getRecordDetail(
        req.securityContext,
        importId,
        recordId
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/approve
   * Approves an import job for execution
   */
  public approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.approvalService) throw new Error('ApprovalService not configured');

      const importId = req.params.id;
      const input = approveImportRequestSchema.parse(req.body || {});

      const result = await this.approvalService.approveImport(
        req.securityContext,
        importId,
        input.comment || input.reason
      );

      res.status(200).json({
        success: true,
        data: result.toJSON()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/submit-approval
   * Submits an import to the alternate business role selected by its policy.
   */
  public submitApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.approvalService) throw new Error('ApprovalService not configured');

      const approval = await this.approvalService.submitForApproval(req.securityContext, req.params.id);
      res.status(200).json({ success: true, data: approval.toJSON() });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/reject
   * Rejects an import job
   */
  public reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.approvalService) throw new Error('ApprovalService not configured');

      const importId = req.params.id;
      const input = rejectImportRequestSchema.parse(req.body || {});

      const result = await this.approvalService.rejectImport(
        req.securityContext,
        importId,
        input.reason
      );

      res.status(200).json({
        success: true,
        data: result.toJSON()
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/execute
   * Executes batch transactional execution of the approved/validated import
   */
  public execute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.executionService) throw new Error('ExecutionService not configured');

      const importId = req.params.id;
      executeImportRequestSchema.parse(req.body || {});

      const result = await this.executionService.executeImport(
        req.securityContext,
        importId
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/execution
   * Returns execution status and summary metrics
   */
  public getExecutionStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.executionService) throw new Error('ExecutionService not configured');

      const importId = req.params.id;
      const result = await this.executionService.getExecutionStatus(
        req.securityContext,
        importId
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/report
   * Returns final reconciled import report
   */
  public getFinalReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.reportingService) throw new Error('ReportingService not configured');

      const importId = req.params.id;
      const result = await this.reportingService.getFinalReport(
        req.securityContext,
        importId
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/reconcile
   * Triggers post-execution reconciliation
   */
  public reconcile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.reconciliationService) throw new Error('ReconciliationService not configured');

      const importId = req.params.id;
      const result = await this.reconciliationService.reconcileImport(
        req.securityContext,
        importId
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/report/export
   * Exports final report as CSV or JSON stream
   */
  public exportReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.reportingService) throw new Error('ReportingService not configured');

      const importId = req.params.id;
      const query = exportReportQuerySchema.parse(req.query);

      const exported = await this.reportingService.exportReport(
        req.securityContext,
        importId,
        query.format
      );

      res.setHeader('Content-Type', exported.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
      res.status(200).send(exported.content);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/failed-records
   * Returns paginated failed records with error codes and retryability
   */
  public getFailedRecords = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.reportingService) throw new Error('ReportingService not configured');

      const importId = req.params.id;
      const query = failedRecordsQuerySchema.parse(req.query);

      const result = await this.reportingService.getFailedRecords(
        req.securityContext,
        importId,
        query
      );

      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          pagination: result.pagination
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /data-imports/:id/failed-records/export
   * Exports failed records CSV with formula injection defense
   */
  public exportFailedRecords = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.reportingService) throw new Error('ReportingService not configured');

      const importId = req.params.id;
      const exported = await this.reportingService.exportFailedRecordsCsv(
        req.securityContext,
        importId
      );

      res.setHeader('Content-Type', exported.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
      res.status(200).send(exported.content);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/retry
   * Safely retries eligible failed records
   */
  public retryFailedRecords = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.retryService) throw new Error('RetryService not configured');

      const importId = req.params.id;
      const body = retryImportRequestSchema.parse(req.body);

      const result = await this.retryService.retryFailedRecords(
        req.securityContext,
        importId,
        body
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /data-imports/:id/export-cleaned
   * Exports final cleaned dataset or rejected records in CSV, XLSX, PDF, or DOCX format
   */
  public exportCleanedDataset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.securityContext) throw new UnauthorizedError();
      if (!this.cleanedExportService) {
        throw new Error('CleanedDataExportService is not configured');
      }

      const importId = req.params.id;
      const format = (req.body?.format || req.query?.format || 'csv').toString().toLowerCase();
      const scope = (req.body?.scope || req.query?.scope || 'cleaned').toString().toLowerCase();
      const columns = Array.isArray(req.body?.columns) ? req.body.columns : undefined;

      const result = await this.cleanedExportService.exportDataset(req.securityContext, importId, {
        format: format as any,
        scope: scope as any,
        columns
      });

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.status(200).send(result.buffer);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /metrics
   * Returns operational metrics
   */
  public getMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.metricsService) {
        res.status(200).json({ success: true, data: { status: 'OK' } });
        return;
      }
      res.status(200).json({
        success: true,
        data: this.metricsService.getMetricsSummary()
      });
    } catch (error) {
      next(error);
    }
  };
}
