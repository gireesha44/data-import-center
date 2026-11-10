/**
 * Data Import API Routes
 */

import { Router } from 'express';
import multer from 'multer';
import { ImportController } from '../controllers/import.controller.js';
import { requirePermission } from '../middleware/auth.middleware.js';
import { DataImportPermission } from '../../core/types/permissions.types.js';

import { DepartmentController } from '../controllers/department.controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

export function createImportRouter(
  controller: ImportController,
  deptController?: DepartmentController
): Router {
  const router = Router();

  if (deptController) {
    // Department Context Routes
    router.get('/departments', requirePermission(DataImportPermission.DATA_IMPORT_VIEW), deptController.getDepartments);
    router.get('/departments/:departmentId/dashboard', requirePermission(DataImportPermission.DATA_IMPORT_VIEW), deptController.getDepartmentDashboard);
    router.get('/departments/:departmentId/entities', requirePermission(DataImportPermission.DATA_IMPORT_VIEW), deptController.getDepartmentEntities);
    router.get('/departments/:departmentId/templates', requirePermission(DataImportPermission.DATA_IMPORT_VIEW), deptController.getDepartmentTemplates);
    router.get('/departments/:departmentId/schemas', requirePermission(DataImportPermission.DATA_IMPORT_VIEW), deptController.getDepartmentSchemas);
    router.get('/departments/:departmentId/imports', requirePermission(DataImportPermission.DATA_IMPORT_VIEW), deptController.getDepartmentImports);
    router.get('/departments/:departmentId/audit-logs', requirePermission(DataImportPermission.DATA_IMPORT_VIEW_AUDIT), deptController.getDepartmentAuditLogs);
  }

  // GET /data-imports/entities - Discover importable entities
  router.get(
    '/entities',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.listEntities
  );

  // GET /data-imports/entities/:entity - Detailed schema for an entity
  router.get(
    '/entities/:entity',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getEntityDetails
  );

  // GET /data-imports/entities/:entity/template - Metadata for downloadable template
  router.get(
    '/entities/:entity/template',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getTemplateMetadata
  );

  // GET /data-imports/entities/:entity/template/download - Download template CSV or XLSX
  router.get(
    '/entities/:entity/template/download',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.downloadTemplate
  );

  // POST /data-imports - Create Draft
  router.post(
    '/',
    requirePermission(DataImportPermission.DATA_IMPORT_CREATE),
    controller.create
  );

  // GET /data-imports - List Imports
  router.get(
    '/',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.list
  );

  // GET /data-imports/:id/workflow-summary - Authoritative cross-step import statistics
  // This route must stay before /:id so Express does not treat 'workflow-summary' as an import id.
  router.get(
    '/:id/workflow-summary',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getWorkflowSummary
  );

  // GET /data-imports/:id - Get Import Details
  router.get(
    '/:id',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getById
  );

  // GET /data-imports/:id/audit - Import audit trail
  router.get(
    '/:id/audit',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW_AUDIT),
    controller.getAuditTrail
  );

  // PATCH /data-imports/:id - Update Draft
  router.patch(
    '/:id',
    requirePermission(DataImportPermission.DATA_IMPORT_CREATE),
    controller.update
  );

  // POST /data-imports/:id/save-draft - Persist resumable draft state
  router.post(
    '/:id/save-draft',
    requirePermission(DataImportPermission.DATA_IMPORT_CREATE),
    controller.saveDraft
  );

  // POST /data-imports/:id/revert-step - Rollback changes of the current step
  router.post(
    '/:id/revert-step',
    requirePermission(DataImportPermission.DATA_IMPORT_CREATE),
    controller.revertStep
  );

  // POST /data-imports/:id/cancel - Cancel Import
  router.post(
    '/:id/cancel',
    requirePermission(DataImportPermission.DATA_IMPORT_CANCEL),
    controller.cancel
  );

  // POST /data-imports/:id/upload - Upload and secure file
  router.post(
    '/:id/upload',
    requirePermission(DataImportPermission.DATA_IMPORT_UPLOAD),
    upload.single('file'),
    controller.upload
  );

  // POST /data-imports/:id/parse - Parse file and produce preview dataset
  router.post(
    '/:id/parse',
    requirePermission(DataImportPermission.DATA_IMPORT_VALIDATE),
    controller.parse
  );

  // GET /data-imports/:id/mapping/suggestions - Auto-generate mapping suggestions
  router.get(
    '/:id/mapping/suggestions',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getMappingSuggestions
  );

  // GET /data-imports/:id/mapping - Get saved mapping
  router.get(
    '/:id/mapping',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getMapping
  );

  // POST /data-imports/:id/mapping - Save mapping configuration
  router.post(
    '/:id/mapping',
    requirePermission(DataImportPermission.DATA_IMPORT_MAP),
    controller.saveMapping
  );

  // POST /data-imports/:id/mapping/validate - Validate mapping without saving
  router.post(
    '/:id/mapping/validate',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.validateMapping
  );

  // DELETE /data-imports/:id/mapping - Clear mapping
  router.delete(
    '/:id/mapping',
    requirePermission(DataImportPermission.DATA_IMPORT_MAP),
    controller.clearMapping
  );

  // POST /data-imports/:id/validate - Validate mapped dataset and stage records
  router.post(
    '/:id/validate',
    requirePermission(DataImportPermission.DATA_IMPORT_VALIDATE),
    controller.validate
  );

  // GET /data-imports/:id/validation-summary - Authoritative validation counters + workflow state
  router.get(
    '/:id/validation-summary',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getValidationSummary
  );

  // GET /data-imports/:id/validation-preview - Get staged records preview & validation summary
  router.get(
    '/:id/validation-preview',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getValidationPreview
  );

  // PATCH /data-imports/:id/records/:recordId/correct - Apply inline record correction & re-validate
  router.patch(
    '/:id/records/:recordId/correct',
    requirePermission(DataImportPermission.DATA_IMPORT_VALIDATE),
    controller.correctRecord
  );

  // POST /data-imports/:id/records/bulk-correct - Apply bulk record correction & re-validate
  router.post(
    '/:id/records/bulk-correct',
    requirePermission(DataImportPermission.DATA_IMPORT_VALIDATE),
    controller.bulkCorrectRecords
  );

  // POST /data-imports/:id/detect-duplicates - Run duplicate detection & matching
  router.post(
    '/:id/detect-duplicates',
    requirePermission(DataImportPermission.DATA_IMPORT_VALIDATE),
    controller.detectDuplicates
  );

  // POST /data-imports/:id/resolve-duplicate-record - Set duplicate resolution action for record
  router.post(
    '/:id/resolve-duplicate-record',
    requirePermission(DataImportPermission.DATA_IMPORT_VALIDATE),
    controller.resolveDuplicateRecord
  );

  // GET /data-imports/:id/match-preview - Paginated duplicate & intent preview
  router.get(
    '/:id/match-preview',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getMatchPreview
  );

  // GET /data-imports/:id/review - Review summary & readiness checklist
  router.get(
    '/:id/review',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getReviewSummary
  );

  // GET /data-imports/:id/review/records - Paginated review records
  router.get(
    '/:id/review/records',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getReviewRecords
  );

  // GET /data-imports/:id/review/records/:recordId - Single record detailed diff
  router.get(
    '/:id/review/records/:recordId',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getRecordDetail
  );

  // POST /data-imports/:id/submit-approval - Submit to the configured business approver
  router.post(
    '/:id/submit-approval',
    requirePermission(DataImportPermission.DATA_IMPORT_CREATE),
    controller.submitApproval
  );

  // POST /data-imports/:id/approve - Approve import job
  router.post(
    '/:id/approve',
    requirePermission(DataImportPermission.DATA_IMPORT_APPROVE),
    controller.approve
  );

  // POST /data-imports/:id/reject - Reject import job
  router.post(
    '/:id/reject',
    requirePermission(DataImportPermission.DATA_IMPORT_APPROVE),
    controller.reject
  );

  // POST /data-imports/:id/execute - Batch transactional execution
  router.post(
    '/:id/execute',
    requirePermission(DataImportPermission.DATA_IMPORT_EXECUTE),
    controller.execute
  );

  // GET /data-imports/:id/execution - Get execution status
  router.get(
    '/:id/execution',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getExecutionStatus
  );

  // POST /data-imports/:id/reconcile - Trigger post-execution reconciliation
  router.post(
    '/:id/reconcile',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.reconcile
  );

  // GET /data-imports/:id/report - Get final reconciled report
  router.get(
    '/:id/report',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getFinalReport
  );

  // GET /data-imports/:id/report/export - Export final report (CSV/JSON)
  router.get(
    '/:id/report/export',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.exportReport
  );

  // GET /data-imports/:id/failed-records - Get paginated failed records
  router.get(
    '/:id/failed-records',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.getFailedRecords
  );

  // GET /data-imports/:id/failed-records/export - Export failed records CSV
  router.get(
    '/:id/failed-records/export',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.exportFailedRecords
  );

  // POST/GET /data-imports/:id/export-cleaned - Export final cleaned dataset (CSV, XLSX, PDF, DOCX)
  router.post(
    '/:id/export-cleaned',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.exportCleanedDataset
  );

  router.get(
    '/:id/export-cleaned',
    requirePermission(DataImportPermission.DATA_IMPORT_VIEW),
    controller.exportCleanedDataset
  );

  return router;
}
