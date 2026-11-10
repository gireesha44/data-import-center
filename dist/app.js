/**
 * Express Application Setup for Data Import Centre
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import { securityContextMiddleware } from './api/middleware/auth.middleware.js';
import { errorHandlerMiddleware } from './api/middleware/error.middleware.js';
import { createImportRouter } from './api/routes/import.routes.js';
import { ImportController } from './api/controllers/import.controller.js';
import { DepartmentController } from './api/controllers/department.controller.js';
import { ImportService } from './domain/services/import.service.js';
import { FileIngestionService } from './domain/services/file-ingestion.service.js';
import { MappingService } from './domain/services/mapping.service.js';
import { ValidationService } from './domain/services/validation.service.js';
import { DuplicateService } from './domain/services/duplicate.service.js';
import { ApprovalService } from './domain/services/approval.service.js';
import { ReviewService } from './domain/services/review.service.js';
import { ExecutionService } from './domain/services/execution.service.js';
import { ReconciliationService } from './domain/services/reconciliation.service.js';
import { ReportingService } from './domain/services/reporting.service.js';
import { RetryService } from './domain/services/retry.service.js';
import { RecoveryService } from './domain/services/recovery.service.js';
import { CleanupService } from './domain/services/cleanup.service.js';
import { metricsService } from './domain/services/metrics.service.js';
import { PersistentDataImportRepository } from './infrastructure/repositories/persistent-data-import.repository.js';
import { PersistentDataImportMappingRepository } from './infrastructure/repositories/persistent-data-import-mapping.repository.js';
import { PersistentDataImportRecordRepository } from './infrastructure/repositories/persistent-data-import-record.repository.js';
import { PersistentDataImportApprovalRepository } from './infrastructure/repositories/persistent-data-import-approval.repository.js';
import { PersistentDataImportExecutionRepository } from './infrastructure/repositories/persistent-data-import-execution.repository.js';
import { PersistentDataImportReconciliationRepository } from './infrastructure/repositories/persistent-data-import-reconciliation.repository.js';
import { persistentTargetMatchProviderRegistry } from './infrastructure/matching/persistent-target-match.provider.js';
import { persistentAuditService } from './infrastructure/services/persistent-audit.service.js';
import { fileStorageService } from './infrastructure/storage/file-storage.service.js';
import { entitySchemaRegistry } from './core/registry/entity-schema.registry.js';
import { CleanedDataExportService } from './domain/services/cleaned-export.service.js';
import { TemplateService } from './domain/services/template.service.js';
export function createApp(deps = {}) {
    const app = express();
    // Basic Middlewares
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    // Security Context
    app.use(securityContextMiddleware);
    // Dependency Resolution
    const repository = deps.repository || new PersistentDataImportRepository();
    const mappingRepository = deps.mappingRepository || new PersistentDataImportMappingRepository();
    const recordRepository = deps.recordRepository || new PersistentDataImportRecordRepository();
    const approvalRepository = deps.approvalRepository || new PersistentDataImportApprovalRepository();
    const executionRepository = deps.executionRepository || new PersistentDataImportExecutionRepository();
    const reconciliationRepository = deps.reconciliationRepository || new PersistentDataImportReconciliationRepository();
    const targetProviderReg = deps.targetProviderRegistry || persistentTargetMatchProviderRegistry;
    const storage = deps.storage || fileStorageService;
    const auditService = deps.auditService || persistentAuditService;
    const importService = new ImportService(repository, auditService, entitySchemaRegistry);
    const fileIngestionService = new FileIngestionService(repository, auditService, storage, mappingRepository, recordRepository);
    const mappingService = new MappingService(repository, mappingRepository, entitySchemaRegistry, auditService, recordRepository);
    const validationService = new ValidationService(repository, mappingRepository, recordRepository, entitySchemaRegistry, auditService, storage, undefined, targetProviderReg);
    const duplicateService = new DuplicateService(repository, recordRepository, targetProviderReg, entitySchemaRegistry, auditService);
    const approvalService = new ApprovalService(repository, mappingRepository, recordRepository, approvalRepository, entitySchemaRegistry, auditService);
    const reviewService = new ReviewService(repository, mappingRepository, recordRepository, approvalService, entitySchemaRegistry);
    const executionService = new ExecutionService(repository, recordRepository, approvalService, executionRepository, targetProviderReg, auditService);
    const reconciliationService = new ReconciliationService(repository, recordRepository, executionRepository, reconciliationRepository, auditService);
    const reportingService = new ReportingService(repository, recordRepository, executionRepository, reconciliationRepository);
    const retryService = new RetryService(repository, recordRepository, executionRepository, targetProviderReg, reconciliationService, reportingService, auditService);
    const recoveryService = new RecoveryService(repository, executionRepository, auditService);
    const cleanupService = new CleanupService(repository, recordRepository, storage, auditService);
    const templateService = new TemplateService(entitySchemaRegistry);
    const cleanedExportService = new CleanedDataExportService(repository, recordRepository, entitySchemaRegistry, storage);
    const importController = new ImportController(importService, fileIngestionService, mappingService, entitySchemaRegistry, validationService, duplicateService, approvalService, reviewService, executionService, reconciliationService, reportingService, retryService, metricsService, auditService, templateService, cleanedExportService);
    // Static Assets & UI Routes
    const publicPath = path.resolve(process.cwd(), 'public');
    if (fs.existsSync(publicPath)) {
        app.use(express.static(publicPath));
        app.use('/data-imports', express.static(publicPath));
        app.get('/data-imports/*', (_req, res) => {
            res.sendFile(path.join(publicPath, 'index.html'));
        });
    }
    const demoFilesPath = path.resolve(process.cwd(), 'demo-files');
    if (fs.existsSync(demoFilesPath)) {
        app.use('/demo-files', express.static(demoFilesPath));
    }
    // Health check endpoint
    app.get('/health', (_req, res) => {
        res.status(200).json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            service: 'data-import-center'
        });
    });
    app.get('/metrics', importController.getMetrics);
    const departmentController = new DepartmentController(repository, templateService);
    // API Routes
    app.use('/api/v1/data-imports', createImportRouter(importController, departmentController));
    // Default root redirect to /data-imports
    app.get('/', (_req, res) => {
        res.redirect('/data-imports');
    });
    // Global Error Handler
    app.use(errorHandlerMiddleware);
    return app;
}
//# sourceMappingURL=app.js.map