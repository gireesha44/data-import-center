/**
 * Execution Service Unit Tests
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionService } from '../../../domain/services/execution.service.js';
import { ApprovalService } from '../../../domain/services/approval.service.js';
import { InMemoryDataImportRepository } from '../../../infrastructure/repositories/in-memory-data-import.repository.js';
import { InMemoryDataImportMappingRepository } from '../../../infrastructure/repositories/in-memory-data-import-mapping.repository.js';
import { InMemoryDataImportRecordRepository } from '../../../infrastructure/repositories/in-memory-data-import-record.repository.js';
import { InMemoryDataImportApprovalRepository } from '../../../infrastructure/repositories/in-memory-data-import-approval.repository.js';
import { InMemoryDataImportExecutionRepository } from '../../../infrastructure/repositories/in-memory-data-import-execution.repository.js';
import { InMemoryTargetMatchProvider, TargetMatchProviderRegistry } from '../../../infrastructure/matching/in-memory-target-match.provider.js';
import { DataImportEntity } from '../../../domain/entities/data-import.entity.js';
import { DataImportMappingEntity } from '../../../domain/entities/data-import-mapping.entity.js';
import { DataImportRecordEntity } from '../../../domain/entities/data-import-record.entity.js';
import { ImportStatus, ImportSourceType, DuplicateStrategy, ErrorStrategy, RecordStatus, ExecutionStatus } from '../../../core/types/import.types.js';
import { DataImportPermission } from '../../../core/types/permissions.types.js';
import { MatchClassification, ExecutionIntentAction } from '../../../core/types/duplicate.types.js';
import { ConflictError } from '../../../core/errors/import.errors.js';
describe('ExecutionService Unit Tests', () => {
    let importRepo;
    let mappingRepo;
    let recordRepo;
    let approvalRepo;
    let execRepo;
    let targetRegistry;
    let contactsProvider;
    let approvalService;
    let executionService;
    const orgId = 'org-exec-100';
    const execUserId = 'user-executor-1';
    const context = {
        userId: execUserId,
        organizationId: orgId,
        roles: ['admin'],
        permissions: [
            DataImportPermission.DATA_IMPORT_VIEW,
            DataImportPermission.DATA_IMPORT_EXECUTE
        ]
    };
    beforeEach(() => {
        importRepo = new InMemoryDataImportRepository();
        mappingRepo = new InMemoryDataImportMappingRepository();
        recordRepo = new InMemoryDataImportRecordRepository();
        approvalRepo = new InMemoryDataImportApprovalRepository();
        execRepo = new InMemoryDataImportExecutionRepository();
        targetRegistry = new TargetMatchProviderRegistry();
        contactsProvider = new InMemoryTargetMatchProvider('contacts');
        targetRegistry.registerProvider(contactsProvider);
        approvalService = new ApprovalService(importRepo, mappingRepo, recordRepo, approvalRepo);
        executionService = new ExecutionService(importRepo, recordRepo, approvalService, execRepo, targetRegistry);
    });
    it('should execute CREATE, UPDATE, and SKIP actions, writing mutations to target provider', async () => {
        // Seed 1 existing record in target system
        contactsProvider.seedRecords(orgId, [
            { id: 'target-existing-1', email: 'sam@corp.com', first_name: 'Sam', last_name: 'Original' }
        ]);
        // Create import job in VALIDATED state
        const importJob = new DataImportEntity({
            id: 'imp-exec-1',
            organizationId: orgId,
            name: 'Batch Execution Import',
            targetModule: 'crm',
            targetEntity: 'contacts',
            sourceType: ImportSourceType.FILE_UPLOAD,
            status: ImportStatus.VALIDATED,
            createdBy: 'creator-user',
            fileMetadata: { duplicateSummary: { duplicateGroups: [] } },
            importOptions: {
                duplicateStrategy: DuplicateStrategy.UPDATE,
                errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
            }
        });
        await importRepo.create(importJob);
        // Save Mapping
        const mapping = new DataImportMappingEntity({
            id: 'map-exec-1',
            organizationId: orgId,
            importId: 'imp-exec-1',
            columnMappings: {
                'email': { sourceColumn: 'email', targetField: 'email', targetType: 'EMAIL', required: true }
            }
        });
        await mappingRepo.save(mapping);
        // Staged Records: 1 CREATE, 1 UPDATE, 1 SKIP, 1 BLOCKED
        const records = [
            new DataImportRecordEntity({
                id: 'rec-create',
                organizationId: orgId,
                importId: 'imp-exec-1',
                rowIndex: 1,
                rawData: { email: 'newbie@corp.com', first_name: 'Newbie', last_name: 'One' },
                transformedData: { email: 'newbie@corp.com', first_name: 'Newbie', last_name: 'One' },
                status: RecordStatus.VALID,
                matchClassification: MatchClassification.NEW,
                matchKey: 'newbie@corp.com',
                executionAction: ExecutionIntentAction.CREATE
            }),
            new DataImportRecordEntity({
                id: 'rec-infile-update',
                organizationId: orgId,
                importId: 'imp-exec-1',
                rowIndex: 2,
                rawData: { email: 'newbie@corp.com', first_name: 'Newbie', last_name: 'User Edited' },
                transformedData: { email: 'newbie@corp.com', first_name: 'Newbie', last_name: 'User Edited' },
                status: RecordStatus.VALID,
                matchClassification: MatchClassification.DUPLICATE_IN_FILE,
                matchKey: 'newbie@corp.com',
                executionAction: ExecutionIntentAction.UPDATE
            }),
            new DataImportRecordEntity({
                id: 'rec-update',
                organizationId: orgId,
                importId: 'imp-exec-1',
                rowIndex: 3,
                rawData: { email: 'sam@corp.com', first_name: 'Sam', last_name: 'Updated' },
                transformedData: { email: 'sam@corp.com', first_name: 'Sam', last_name: 'Updated' },
                status: RecordStatus.VALID,
                matchClassification: MatchClassification.EXISTING,
                targetRecordId: 'target-existing-1',
                executionAction: ExecutionIntentAction.UPDATE
            }),
            new DataImportRecordEntity({
                id: 'rec-skip',
                organizationId: orgId,
                importId: 'imp-exec-1',
                rowIndex: 4,
                rawData: { email: 'skip@corp.com' },
                transformedData: { email: 'skip@corp.com' },
                status: RecordStatus.VALID,
                matchClassification: MatchClassification.DUPLICATE_IN_FILE,
                executionAction: ExecutionIntentAction.SKIP
            }),
            new DataImportRecordEntity({
                id: 'rec-blocked',
                organizationId: orgId,
                importId: 'imp-exec-1',
                rowIndex: 5,
                rawData: { email: 'bad' },
                status: RecordStatus.INVALID,
                matchClassification: MatchClassification.INVALID,
                executionAction: ExecutionIntentAction.BLOCKED,
                isBlocked: true
            })
        ];
        await recordRepo.saveBatch(records);
        // Approve import by authorized approver (different user than creator)
        const requesterContext = {
            userId: 'creator-user',
            organizationId: orgId,
            roles: ['admin'],
            permissions: [DataImportPermission.DATA_IMPORT_VIEW, DataImportPermission.DATA_IMPORT_CREATE]
        };
        const approverContext = {
            userId: 'approver-lead',
            organizationId: orgId,
            roles: ['sales_manager'],
            permissions: [
                DataImportPermission.DATA_IMPORT_VIEW,
                DataImportPermission.DATA_IMPORT_APPROVE
            ]
        };
        await approvalService.submitForApproval(requesterContext, 'imp-exec-1');
        await approvalService.approveImport(approverContext, 'imp-exec-1', 'Approved for test execution');
        const summary = await executionService.executeImport(context, 'imp-exec-1');
        assert.equal(summary.status, ExecutionStatus.COMPLETED);
        assert.equal(summary.successfulCreates, 1);
        assert.equal(summary.successfulUpdates, 2);
        assert.equal(summary.skippedRecords, 1);
        assert.equal(summary.blockedRecords, 1);
        assert.equal(summary.failedRecords, 0);
        // Verify Target Provider writes
        const updatedTarget = await contactsProvider.getRecord(orgId, 'target-existing-1');
        assert.equal(updatedTarget?.last_name, 'Updated');
        const updatedStaged = await recordRepo.findByImportId(orgId, 'imp-exec-1');
        const createRow = updatedStaged.data.find((r) => r.id === 'rec-create');
        const inFileUpdateRow = updatedStaged.data.find((r) => r.id === 'rec-infile-update');
        const updateRow = updatedStaged.data.find((r) => r.id === 'rec-update');
        const skipRow = updatedStaged.data.find((r) => r.id === 'rec-skip');
        const blockedRow = updatedStaged.data.find((r) => r.id === 'rec-blocked');
        assert.equal(createRow?.status, RecordStatus.CREATED);
        assert.ok(createRow?.targetRecordId?.startsWith('target_contacts_'));
        assert.equal(inFileUpdateRow?.status, RecordStatus.UPDATED);
        assert.equal(inFileUpdateRow?.targetRecordId, createRow?.targetRecordId);
        const createdAndUpdatedTarget = await contactsProvider.getRecord(orgId, createRow.targetRecordId);
        assert.equal(createdAndUpdatedTarget?.last_name, 'User Edited');
        assert.equal(updateRow?.status, RecordStatus.UPDATED);
        assert.equal(skipRow?.status, RecordStatus.SKIPPED);
        assert.equal(blockedRow?.status, RecordStatus.REJECTED);
        // Check Import State
        const finishedJob = await importRepo.findById(orgId, 'imp-exec-1');
        assert.equal(finishedJob?.status, ImportStatus.COMPLETED);
    });
    it('should prevent simultaneous concurrent execution attempts with ConflictError', async () => {
        const importJob = new DataImportEntity({
            id: 'imp-lock-test',
            organizationId: orgId,
            name: 'Lock Test Import',
            targetModule: 'crm',
            targetEntity: 'contacts',
            sourceType: ImportSourceType.FILE_UPLOAD,
            status: ImportStatus.PROCESSING, // Already executing
            createdBy: 'creator'
        });
        await importRepo.create(importJob);
        await assert.rejects(async () => {
            await executionService.executeImport(context, 'imp-lock-test');
        }, (err) => {
            assert.ok(err instanceof ConflictError);
            return true;
        });
    });
});
//# sourceMappingURL=execution-service.test.js.map