/**
 * Reporting Service Unit Tests with Formula Injection Defense
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ReportingService } from '../../../domain/services/reporting.service.js';
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
import { ExecutionIntentAction } from '../../../core/types/duplicate.types.js';

describe('ReportingService Unit Tests', () => {
  let importRepo: InMemoryDataImportRepository;
  let recordRepo: InMemoryDataImportRecordRepository;
  let execRepo: InMemoryDataImportExecutionRepository;
  let reconRepo: InMemoryDataImportReconciliationRepository;
  let reportingService: ReportingService;

  const orgId = 'org-rep-test';
  const userId = 'user-rep-1';

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

    reportingService = new ReportingService(
      importRepo,
      recordRepo,
      execRepo,
      reconRepo
    );
  });

  it('should compile comprehensive final import report with accurate phase metrics', async () => {
    const importJob = new DataImportEntity({
      id: 'imp-rep-1',
      organizationId: orgId,
      name: 'Report Test Import',
      targetModule: 'crm',
      targetEntity: 'contacts',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.COMPLETED,
      createdBy: userId,
      importOptions: {
        duplicateStrategy: DuplicateStrategy.SKIP,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    });
    await importRepo.create(importJob);

    const records = [
      new DataImportRecordEntity({
        id: 'r-success',
        organizationId: orgId,
        importId: 'imp-rep-1',
        rowIndex: 1,
        rawData: { email: 'alice@corp.com' },
        status: RecordStatus.CREATED,
        executionAction: ExecutionIntentAction.CREATE
      }),
      new DataImportRecordEntity({
        id: 'r-failed',
        organizationId: orgId,
        importId: 'imp-rep-1',
        rowIndex: 2,
        rawData: { email: 'bob@corp.com' },
        status: RecordStatus.FAILED,
        executionAction: ExecutionIntentAction.CREATE,
        errorCode: 'TIMEOUT_ERROR',
        errorMessage: 'Connection timeout during write'
      })
    ];
    await recordRepo.saveBatch(records);

    const report = await reportingService.getFinalReport(context, 'imp-rep-1');

    assert.equal(report.importInfo.importId, 'imp-rep-1');
    assert.equal(report.execution.created, 1);
    assert.equal(report.execution.failed, 1);
    assert.equal(report.failedRecordsSummary.totalFailed, 1);
    assert.equal(report.failedRecordsSummary.retryableCount, 1);
    assert.equal(report.failedRecordsSummary.nonRetryableCount, 0);
  });

  it('should sanitize dangerous formula prefixes in CSV export (Formula Injection Defense)', async () => {
    // Test direct sanitizer
    assert.equal(reportingService.sanitizeCsvField('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    assert.equal(reportingService.sanitizeCsvField('+cmd|/c calc'), "'+cmd|/c calc");
    assert.equal(reportingService.sanitizeCsvField('-123'), "'-123");
    assert.equal(reportingService.sanitizeCsvField('@dangerous_func'), "'@dangerous_func");
    assert.equal(reportingService.sanitizeCsvField('\tTAB_PREFIX'), "'\tTAB_PREFIX");
    assert.equal(reportingService.sanitizeCsvField('normal text'), 'normal text');
    assert.equal(reportingService.sanitizeCsvField('text, with, commas'), '"text, with, commas"');
  });

  it('should paginate failed records and categorize error codes correctly', async () => {
    const importJob = new DataImportEntity({
      id: 'imp-failed-rep',
      organizationId: orgId,
      name: 'Failed Records Test',
      targetModule: 'crm',
      targetEntity: 'contacts',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.COMPLETED_WITH_ERRORS,
      createdBy: userId,
      importOptions: {
        duplicateStrategy: DuplicateStrategy.SKIP,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    });
    await importRepo.create(importJob);

    const records = [
      new DataImportRecordEntity({
        id: 'rf1',
        organizationId: orgId,
        importId: 'imp-failed-rep',
        rowIndex: 1,
        rawData: { email: 'bad_email' },
        status: RecordStatus.FAILED,
        errorCode: 'VAL_REQUIRED_MISSING',
        errorMessage: 'Email is required'
      }),
      new DataImportRecordEntity({
        id: 'rf2',
        organizationId: orgId,
        importId: 'imp-failed-rep',
        rowIndex: 2,
        rawData: { email: 'transient@corp.com' },
        status: RecordStatus.FAILED,
        errorCode: 'TRANSIENT_DB_TIMEOUT',
        errorMessage: 'Database connection timed out'
      })
    ];
    await recordRepo.saveBatch(records);

    const result = await reportingService.getFailedRecords(context, 'imp-failed-rep');

    assert.equal(result.pagination.total, 2);
    const nonRetryable = result.data.find((r) => r.id === 'rf1');
    const retryable = result.data.find((r) => r.id === 'rf2');

    assert.equal(nonRetryable?.retryability, 'NON_RETRYABLE');
    assert.equal(nonRetryable?.isRetryable, false);

    assert.equal(retryable?.retryability, 'RETRYABLE');
    assert.equal(retryable?.isRetryable, true);
  });
});
