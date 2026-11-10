/**
 * Retry & Recovery Unit Tests
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RetryService } from '../../../domain/services/retry.service.js';
import { RecoveryService } from '../../../domain/services/recovery.service.js';
import { ReconciliationService } from '../../../domain/services/reconciliation.service.js';
import { ReportingService } from '../../../domain/services/reporting.service.js';
import { InMemoryDataImportRepository } from '../../../infrastructure/repositories/in-memory-data-import.repository.js';
import { InMemoryDataImportRecordRepository } from '../../../infrastructure/repositories/in-memory-data-import-record.repository.js';
import { InMemoryDataImportExecutionRepository } from '../../../infrastructure/repositories/in-memory-data-import-execution.repository.js';
import { InMemoryDataImportReconciliationRepository } from '../../../infrastructure/repositories/in-memory-data-import-reconciliation.repository.js';
import { InMemoryTargetMatchProvider, TargetMatchProviderRegistry } from '../../../infrastructure/matching/in-memory-target-match.provider.js';
import { DataImportEntity } from '../../../domain/entities/data-import.entity.js';
import { DataImportRecordEntity } from '../../../domain/entities/data-import-record.entity.js';
import { ImportStatus, ImportSourceType, DuplicateStrategy, ErrorStrategy, RecordStatus } from '../../../core/types/import.types.js';
import { DataImportPermission } from '../../../core/types/permissions.types.js';
import { ExecutionIntentAction } from '../../../core/types/duplicate.types.js';
import { ValidationError } from '../../../core/errors/import.errors.js';
describe('Retry & Recovery Unit Tests', () => {
    let importRepo;
    let recordRepo;
    let execRepo;
    let reconRepo;
    let targetRegistry;
    let contactsProvider;
    let reconciliationService;
    let reportingService;
    let retryService;
    let recoveryService;
    const orgId = 'org-retry-test';
    const userId = 'user-retry-1';
    const context = {
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
        targetRegistry = new TargetMatchProviderRegistry();
        contactsProvider = new InMemoryTargetMatchProvider('contacts');
        targetRegistry.registerProvider(contactsProvider);
        reconciliationService = new ReconciliationService(importRepo, recordRepo, execRepo, reconRepo);
        reportingService = new ReportingService(importRepo, recordRepo, execRepo, reconRepo);
        retryService = new RetryService(importRepo, recordRepo, execRepo, targetRegistry, reconciliationService, reportingService);
        recoveryService = new RecoveryService(importRepo, execRepo);
    });
    it('should successfully retry retryable failed records and update status to CREATED', async () => {
        const importJob = new DataImportEntity({
            id: 'imp-retry-1',
            organizationId: orgId,
            name: 'Retry Test Import',
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
                id: 'r-transient',
                organizationId: orgId,
                importId: 'imp-retry-1',
                rowIndex: 1,
                rawData: { email: 'retryme@corp.com', first_name: 'Retry', last_name: 'Me' },
                transformedData: { email: 'retryme@corp.com', first_name: 'Retry', last_name: 'Me' },
                status: RecordStatus.FAILED,
                executionAction: ExecutionIntentAction.CREATE,
                errorCode: 'TRANSIENT_NETWORK_FAILURE',
                errorMessage: 'Temporary network issue'
            })
        ];
        await recordRepo.saveBatch(records);
        const result = await retryService.retryFailedRecords(context, 'imp-retry-1');
        assert.equal(result.recordsRetried, 1);
        assert.equal(result.newlySucceeded, 1);
        assert.equal(result.stillFailing, 0);
        // Verify record is now CREATED in target provider and record repo
        const updated = await recordRepo.findById(orgId, 'r-transient');
        assert.equal(updated?.status, RecordStatus.CREATED);
        assert.ok(updated?.targetRecordId?.startsWith('target_contacts_'));
        // Check target provider
        const targetRecord = await contactsProvider.getRecord(orgId, updated.targetRecordId);
        assert.equal(targetRecord?.email, 'retryme@corp.com');
    });
    it('should reject retry when only non-retryable errors exist unless forced', async () => {
        const importJob = new DataImportEntity({
            id: 'imp-non-retry',
            organizationId: orgId,
            name: 'Non Retryable Test',
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
                id: 'r-val-error',
                organizationId: orgId,
                importId: 'imp-non-retry',
                rowIndex: 1,
                rawData: { email: 'invalid' },
                status: RecordStatus.FAILED,
                errorCode: 'VAL_CONSTRAINT_VIOLATION',
                errorMessage: 'Invalid syntax'
            })
        ];
        await recordRepo.saveBatch(records);
        await assert.rejects(async () => {
            await retryService.retryFailedRecords(context, 'imp-non-retry');
        }, (err) => {
            assert.ok(err instanceof ValidationError);
            return true;
        });
    });
    it('should detect and recover orphaned executions stuck in PROCESSING', async () => {
        const oldDate = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
        const orphanedJob = new DataImportEntity({
            id: 'imp-orphan-1',
            organizationId: orgId,
            name: 'Orphaned Import Job',
            targetModule: 'crm',
            targetEntity: 'contacts',
            sourceType: ImportSourceType.FILE_UPLOAD,
            status: ImportStatus.PROCESSING,
            createdBy: userId,
            createdAt: oldDate,
            updatedAt: oldDate
        });
        await importRepo.create(orphanedJob);
        const recoverySummary = await recoveryService.detectAndRecoverOrphans(orgId, 10 * 60 * 1000);
        assert.equal(recoverySummary.recoveredJobs, 1);
        assert.ok(recoverySummary.recoveredJobIds.includes('imp-orphan-1'));
        const recovered = await importRepo.findById(orgId, 'imp-orphan-1');
        assert.equal(recovered?.status, ImportStatus.FAILED);
    });
});
//# sourceMappingURL=retry-recovery.test.js.map