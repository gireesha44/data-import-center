/**
 * Reconciliation Service Unit Tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ReconciliationService } from '../../../domain/services/reconciliation.service.js';
import { InMemoryDataImportRepository } from '../../../infrastructure/repositories/in-memory-data-import.repository.js';
import { InMemoryDataImportRecordRepository } from '../../../infrastructure/repositories/in-memory-data-import-record.repository.js';
import { InMemoryDataImportExecutionRepository } from '../../../infrastructure/repositories/in-memory-data-import-execution.repository.js';
import { InMemoryDataImportReconciliationRepository } from '../../../infrastructure/repositories/in-memory-data-import-reconciliation.repository.js';
import { DataImportEntity } from '../../../domain/entities/data-import.entity.js';
import { DataImportRecordEntity } from '../../../domain/entities/data-import-record.entity.js';
import {
  ImportStatus,
  ImportSourceType,
  DuplicateStrategy,
  ErrorStrategy,
  RecordStatus
} from '../../../core/types/import.types.js';
import {
  SecurityContext,
  DataImportPermission
} from '../../../core/types/permissions.types.js';
import { MatchClassification, ExecutionIntentAction } from '../../../core/types/duplicate.types.js';
import {
  ReconciliationStatus,
  ReconciliationMismatchType
} from '../../../core/types/reconciliation.types.js';

describe('ReconciliationService Unit Tests', () => {
  let importRepo: InMemoryDataImportRepository;
  let recordRepo: InMemoryDataImportRecordRepository;
  let execRepo: InMemoryDataImportExecutionRepository;
  let reconRepo: InMemoryDataImportReconciliationRepository;
  let reconciliationService: ReconciliationService;

  const orgId = 'org-recon-test';
  const userId = 'user-recon-1';

  const context: SecurityContext = {
    userId,
    organizationId: orgId,
    roles: ['admin'],
    permissions: [
      DataImportPermission.DATA_IMPORT_VIEW,
      DataImportPermission.DATA_IMPORT_EXECUTE
    ]
  };

  beforeEach(() => {
    importRepo = new InMemoryDataImportRepository();
    recordRepo = new InMemoryDataImportRecordRepository();
    execRepo = new InMemoryDataImportExecutionRepository();
    reconRepo = new InMemoryDataImportReconciliationRepository();

    reconciliationService = new ReconciliationService(
      importRepo,
      recordRepo,
      execRepo,
      reconRepo
    );
  });

  it('should successfully reconcile when all intended actions match actual outcomes', async () => {
    const importJob = new DataImportEntity({
      id: 'imp-recon-1',
      organizationId: orgId,
      name: 'Full Success Import',
      targetModule: 'crm',
      targetEntity: 'contacts',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.PROCESSING,
      createdBy: userId,
      importOptions: {
        duplicateStrategy: DuplicateStrategy.SKIP,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    });
    await importRepo.create(importJob);

    const records = [
      new DataImportRecordEntity({
        id: 'r1',
        organizationId: orgId,
        importId: 'imp-recon-1',
        rowIndex: 1,
        rawData: { email: 'a@corp.com' },
        status: RecordStatus.CREATED,
        executionAction: ExecutionIntentAction.CREATE
      }),
      new DataImportRecordEntity({
        id: 'r2',
        organizationId: orgId,
        importId: 'imp-recon-1',
        rowIndex: 2,
        rawData: { email: 'b@corp.com' },
        status: RecordStatus.UPDATED,
        executionAction: ExecutionIntentAction.UPDATE,
        targetRecordId: 'target-2'
      }),
      new DataImportRecordEntity({
        id: 'r3',
        organizationId: orgId,
        importId: 'imp-recon-1',
        rowIndex: 3,
        rawData: { email: 'c@corp.com' },
        status: RecordStatus.SKIPPED,
        executionAction: ExecutionIntentAction.SKIP
      })
    ];
    await recordRepo.saveBatch(records);

    const result = await reconciliationService.reconcileImport(context, 'imp-recon-1');

    assert.equal(result.status, ReconciliationStatus.FULLY_RECONCILED);
    assert.equal(result.mismatchCount, 0);
    assert.equal(result.plannedRecords, 3);
    assert.equal(result.createdRecords, 1);
    assert.equal(result.updatedRecords, 1);
    assert.equal(result.skippedRecords, 1);
    assert.equal(result.failedRecords, 0);
    assert.equal(result.varianceCount, 0);

    // Verify import state transition to COMPLETED
    const updatedJob = await importRepo.findById(orgId, 'imp-recon-1');
    assert.equal(updatedJob?.status, ImportStatus.COMPLETED);
  });

  it('keeps rejected, blocked and skipped outcomes distinct and accounts for every source row', async () => {
    const importJob = new DataImportEntity({
      id: 'imp-recon-outcomes',
      organizationId: orgId,
      name: 'Distinct outcomes',
      targetModule: 'crm',
      targetEntity: 'contacts',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.PROCESSING,
      totalRecords: 3,
      createdBy: userId
    });
    await importRepo.create(importJob);
    await recordRepo.saveBatch([
      new DataImportRecordEntity({
        id: 'r-explicit-reject',
        organizationId: orgId,
        importId: importJob.id,
        rowIndex: 1,
        rawData: { email: 'rejected@example.com' },
        status: RecordStatus.REJECTED,
        executionAction: ExecutionIntentAction.REJECT
      }),
      new DataImportRecordEntity({
        id: 'r-validation-block',
        organizationId: orgId,
        importId: importJob.id,
        rowIndex: 2,
        rawData: { email: 'invalid@example.com' },
        status: RecordStatus.INVALID,
        executionAction: ExecutionIntentAction.BLOCKED
      }),
      new DataImportRecordEntity({
        id: 'r-duplicate-skip',
        organizationId: orgId,
        importId: importJob.id,
        rowIndex: 3,
        rawData: { email: 'duplicate@example.com' },
        status: RecordStatus.SKIPPED_DUPLICATE,
        executionAction: ExecutionIntentAction.SKIP
      })
    ]);

    const result = await reconciliationService.reconcileImport(context, importJob.id);

    assert.equal(result.rejectedRecords, 1);
    assert.equal(result.blockedRecords, 1);
    assert.equal(result.skippedRecords, 1);
    assert.equal(result.varianceCount, 0);
    assert.equal(result.status, ReconciliationStatus.FULLY_RECONCILED);
  });

  it('flags a source row with no recorded outcome as reconciliation variance', async () => {
    const importJob = new DataImportEntity({
      id: 'imp-recon-variance',
      organizationId: orgId,
      name: 'Missing outcome',
      targetModule: 'crm',
      targetEntity: 'contacts',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.PROCESSING,
      totalRecords: 2,
      createdBy: userId
    });
    await importRepo.create(importJob);
    await recordRepo.saveBatch([
      new DataImportRecordEntity({
        id: 'r-single-outcome',
        organizationId: orgId,
        importId: importJob.id,
        rowIndex: 1,
        rawData: { email: 'created@example.com' },
        status: RecordStatus.CREATED,
        executionAction: ExecutionIntentAction.CREATE
      })
    ]);

    const result = await reconciliationService.reconcileImport(context, importJob.id);

    assert.equal(result.varianceCount, 1);
    assert.equal(result.status, ReconciliationStatus.MISMATCHED);
  });

  it('should detect mismatches and flag PARTIALLY_RECONCILED or MISMATCHED on divergence', async () => {
    const importJob = new DataImportEntity({
      id: 'imp-recon-fail',
      organizationId: orgId,
      name: 'Partial Mismatch Import',
      targetModule: 'crm',
      targetEntity: 'contacts',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.PROCESSING,
      createdBy: userId,
      importOptions: {
        duplicateStrategy: DuplicateStrategy.SKIP,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    });
    await importRepo.create(importJob);

    const records = [
      new DataImportRecordEntity({
        id: 'r-fail-1',
        organizationId: orgId,
        importId: 'imp-recon-fail',
        rowIndex: 1,
        rawData: { email: 'fail@corp.com' },
        status: RecordStatus.FAILED,
        executionAction: ExecutionIntentAction.CREATE,
        errorCode: 'DB_CONNECTION_TIMEOUT',
        errorMessage: 'Connection lost'
      }),
      new DataImportRecordEntity({
        id: 'r-mismatch-2',
        organizationId: orgId,
        importId: 'imp-recon-fail',
        rowIndex: 2,
        rawData: { email: 'bad@corp.com' },
        status: RecordStatus.INVALID, // Planned UPDATE but remained INVALID
        executionAction: ExecutionIntentAction.UPDATE
      })
    ];
    await recordRepo.saveBatch(records);

    const result = await reconciliationService.reconcileImport(context, 'imp-recon-fail');

    assert.equal(result.status, ReconciliationStatus.MISMATCHED);
    assert.ok(result.mismatchCount >= 1);
    assert.equal(result.failedRecords, 1);

    // Verify import state transitioned to RECONCILIATION_REQUIRED
    const updatedJob = await importRepo.findById(orgId, 'imp-recon-fail');
    assert.equal(updatedJob?.status, ImportStatus.RECONCILIATION_REQUIRED);
  });
});
