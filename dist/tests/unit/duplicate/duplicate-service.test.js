/**
 * Duplicate Service Unit Tests
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DuplicateService } from '../../../domain/services/duplicate.service.js';
import { InMemoryDataImportRepository } from '../../../infrastructure/repositories/in-memory-data-import.repository.js';
import { InMemoryDataImportRecordRepository } from '../../../infrastructure/repositories/in-memory-data-import-record.repository.js';
import { InMemoryTargetMatchProvider, TargetMatchProviderRegistry } from '../../../infrastructure/matching/in-memory-target-match.provider.js';
import { DataImportEntity } from '../../../domain/entities/data-import.entity.js';
import { DataImportRecordEntity } from '../../../domain/entities/data-import-record.entity.js';
import { CleanedDataExportService } from '../../../domain/services/cleaned-export.service.js';
import { entitySchemaRegistry } from '../../../core/registry/entity-schema.registry.js';
import { ImportStatus, ImportSourceType, DuplicateStrategy, ErrorStrategy, RecordStatus } from '../../../core/types/import.types.js';
import { DataImportPermission } from '../../../core/types/permissions.types.js';
import { MatchClassification, ExecutionIntentAction } from '../../../core/types/duplicate.types.js';
describe('DuplicateService Unit Tests', () => {
    let importRepo;
    let recordRepo;
    let providerRegistry;
    let contactsProvider;
    let service;
    const validContext = {
        userId: 'user-dup-1',
        organizationId: 'org-dup-100',
        roles: ['admin'],
        permissions: [
            DataImportPermission.DATA_IMPORT_VIEW,
            DataImportPermission.DATA_IMPORT_CREATE,
            DataImportPermission.DATA_IMPORT_VALIDATE,
            DataImportPermission.DATA_IMPORT_EXECUTE
        ]
    };
    beforeEach(() => {
        importRepo = new InMemoryDataImportRepository();
        recordRepo = new InMemoryDataImportRecordRepository();
        providerRegistry = new TargetMatchProviderRegistry();
        contactsProvider = new InMemoryTargetMatchProvider('contacts');
        providerRegistry.registerProvider(contactsProvider);
        service = new DuplicateService(importRepo, recordRepo, providerRegistry);
    });
    it('should detect duplicates, update staged records and return comprehensive summary', async () => {
        // Seed Target System
        contactsProvider.seedRecords(validContext.organizationId, [
            { id: 'target-existing-1', email: 'sam@corp.com', first_name: 'Sam', last_name: 'Old' }
        ]);
        // Create Import Job in VALIDATED state
        const importJob = new DataImportEntity({
            id: 'imp-dup-1',
            organizationId: validContext.organizationId,
            name: 'Duplicate Test Import',
            targetModule: 'crm',
            targetEntity: 'contacts',
            sourceType: ImportSourceType.FILE_UPLOAD,
            status: ImportStatus.VALIDATED,
            createdBy: validContext.userId,
            importOptions: {
                duplicateStrategy: DuplicateStrategy.UPDATE,
                errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
            }
        });
        await importRepo.create(importJob);
        // Seed Staged Records: 1 existing, 1 new, 1 duplicate in file
        const records = [
            new DataImportRecordEntity({
                id: 'rec-1',
                organizationId: validContext.organizationId,
                importId: 'imp-dup-1',
                rowIndex: 1,
                rawData: { email: 'sam@corp.com', first_name: 'Sam', last_name: 'New' },
                transformedData: { email: 'sam@corp.com', first_name: 'Sam', last_name: 'New' },
                status: RecordStatus.VALID
            }),
            new DataImportRecordEntity({
                id: 'rec-2',
                organizationId: validContext.organizationId,
                importId: 'imp-dup-1',
                rowIndex: 2,
                rawData: { email: 'lucy@corp.com', first_name: 'Lucy', last_name: 'Sky' },
                transformedData: { email: 'lucy@corp.com', first_name: 'Lucy', last_name: 'Sky' },
                status: RecordStatus.VALID
            }),
            new DataImportRecordEntity({
                id: 'rec-3',
                organizationId: validContext.organizationId,
                importId: 'imp-dup-1',
                rowIndex: 3,
                rawData: { email: 'lucy@corp.com', first_name: 'Lucy', last_name: 'Duplicate' },
                transformedData: { email: 'lucy@corp.com', first_name: 'Lucy', last_name: 'Duplicate' },
                status: RecordStatus.VALID
            })
        ];
        await recordRepo.saveBatch(records);
        const summary = await service.detectDuplicates(validContext, 'imp-dup-1');
        assert.equal(summary.totalRecords, 3);
        assert.equal(summary.existingRecords, 1);
        assert.equal(summary.newRecords, 1);
        assert.equal(summary.duplicateInFile, 1);
        assert.equal(summary.duplicateRecords, 2);
        assert.equal(summary.updates, 1);
        assert.equal(summary.creates, 1);
        assert.equal(summary.skips, 0);
        assert.equal(summary.reviews, 1);
        // Verify Staged Records were updated with matching decisions
        const updatedRecords = await recordRepo.findByImportId(validContext.organizationId, 'imp-dup-1');
        const rec1 = updatedRecords.data.find((r) => r.id === 'rec-1');
        const rec2 = updatedRecords.data.find((r) => r.id === 'rec-2');
        const rec3 = updatedRecords.data.find((r) => r.id === 'rec-3');
        assert.equal(rec1?.matchClassification, MatchClassification.EXISTING);
        assert.equal(rec1?.targetRecordId, 'target-existing-1');
        assert.equal(rec1?.executionAction, ExecutionIntentAction.UPDATE);
        assert.equal(rec2?.matchClassification, MatchClassification.NEW);
        assert.equal(rec2?.executionAction, ExecutionIntentAction.CREATE);
        assert.equal(rec3?.matchClassification, MatchClassification.DUPLICATE_IN_FILE);
        assert.equal(rec3?.executionAction, ExecutionIntentAction.REVIEW);
        // Test getMatchPreview endpoint
        const preview = await service.getMatchPreview(validContext, 'imp-dup-1', {
            classification: MatchClassification.EXISTING
        });
        assert.equal(preview.data.length, 1);
        assert.equal(preview.data[0].id, 'rec-1');
        assert.equal(preview.data[0].matchedTargetId, 'target-existing-1');
        // Test resolveRecord endpoint: update rec-3 from SKIP to REJECT
        const updatedSummary = await service.resolveRecord(validContext, 'imp-dup-1', 'rec-3', 'REJECT', 'Record does not meet acceptance criteria');
        assert.ok(updatedSummary);
        assert.equal(updatedSummary.rejected, 1);
        const recheckRec3 = await recordRepo.findById(validContext.organizationId, 'rec-3');
        assert.equal(recheckRec3?.executionAction, ExecutionIntentAction.REJECT);
        assert.equal(recheckRec3?.status, RecordStatus.REJECTED);
        assert.equal(recheckRec3?.blockedReason, 'Record does not meet acceptance criteria');
        assert.equal((await recordRepo.findByImportId(validContext.organizationId, 'imp-dup-1')).data.length, 3);
        // Test resolveRecord back to SKIP
        const reSummary = await service.resolveRecord(validContext, 'imp-dup-1', 'rec-3', 'SKIP');
        assert.equal(reSummary.skips, 1);
        assert.equal(reSummary.rejected, 0);
        const editedDuplicate = await recordRepo.findById(validContext.organizationId, 'rec-3');
        assert.ok(editedDuplicate);
        editedDuplicate.transformedData = {
            ...(editedDuplicate.transformedData || {}),
            last_name: 'Updated Duplicate'
        };
        await recordRepo.saveBatch([editedDuplicate]);
        const updateSummary = await service.resolveRecord(validContext, 'imp-dup-1', 'rec-3', 'UPDATE');
        let resolvedGroup = updateSummary.duplicateGroups.find((group) => group.records.some((record) => record.recordId === 'rec-3'));
        let resolvedRow = resolvedGroup?.records.find((record) => record.recordId === 'rec-3');
        let persistedRecord = await recordRepo.findById(validContext.organizationId, 'rec-3');
        assert.equal(updateSummary.updates, 1);
        assert.equal(updateSummary.skips, 0);
        assert.equal(updateSummary.reviews, 1);
        assert.equal(resolvedRow?.resolutionAction, ExecutionIntentAction.REVIEW);
        assert.equal(resolvedRow?.data.last_name, 'Updated Duplicate');
        assert.equal(persistedRecord?.executionAction, ExecutionIntentAction.REVIEW);
        assert.equal(updateSummary.recordResolution?.resolved, false);
        assert.equal(persistedRecord?.status, RecordStatus.REQUIRES_REVIEW);
        assert.match(persistedRecord?.blockedReason || '', /still match source row 2/);
        assert.equal(persistedRecord?.transformedData?.last_name, 'Updated Duplicate');
        persistedRecord.rawData = { ...persistedRecord.rawData, email: 'lucy-updated@corp.com' };
        persistedRecord.transformedData = { ...persistedRecord.transformedData, email: 'lucy-updated@corp.com' };
        persistedRecord.status = RecordStatus.VALID;
        await recordRepo.saveBatch([persistedRecord]);
        const changedKeySummary = await service.resolveRecord(validContext, 'imp-dup-1', 'rec-3', 'UPDATE');
        const allGroups = [...(changedKeySummary.duplicateGroups || []), ...(changedKeySummary.resolvedDuplicateGroups || [])];
        resolvedGroup = allGroups.find((group) => group.records.some((record) => record.recordId === 'rec-3'));
        resolvedRow = resolvedGroup?.records.find((record) => record.recordId === 'rec-3');
        persistedRecord = await recordRepo.findById(validContext.organizationId, 'rec-3');
        assert.equal(changedKeySummary.updates, 1);
        assert.equal(changedKeySummary.creates, 2);
        assert.equal(changedKeySummary.resolvedUpdates, 1);
        assert.equal(resolvedRow?.resolutionAction, ExecutionIntentAction.CREATE);
        assert.equal(resolvedRow?.data.last_name, 'Updated Duplicate');
        assert.equal(persistedRecord?.executionAction, ExecutionIntentAction.CREATE);
        assert.equal(persistedRecord?.matchClassification, MatchClassification.NEW);
        assert.equal(persistedRecord?.isDuplicate, false);
        assert.equal(persistedRecord?.transformedData?.email, 'lucy-updated@corp.com');
        assert.equal(changedKeySummary.recordResolution?.resolved, true);
        const exportService = new CleanedDataExportService(importRepo, recordRepo, entitySchemaRegistry);
        const cleanedExport = await exportService.exportDataset(validContext, 'imp-dup-1', { format: 'csv' });
        assert.match(cleanedExport.buffer.toString('utf-8'), /Updated Duplicate/);
        assert.match(cleanedExport.buffer.toString('utf-8'), /lucy-updated@corp\.com/);
        const unchangedPrimary = await recordRepo.findById(validContext.organizationId, 'rec-2');
        assert.equal(unchangedPrimary?.transformedData?.last_name, 'Sky');
    });
    it('re-detects duplicates after edits to either the primary or duplicate row', async () => {
        const createDuplicateImport = async (importId) => {
            const importJob = new DataImportEntity({
                id: importId,
                organizationId: validContext.organizationId,
                name: 'Editable Duplicate Import',
                targetModule: 'hr',
                targetEntity: 'employees',
                sourceType: ImportSourceType.FILE_UPLOAD,
                status: ImportStatus.VALIDATED,
                createdBy: validContext.userId,
                importOptions: {
                    duplicateStrategy: DuplicateStrategy.UPDATE,
                    errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
                }
            });
            await importRepo.create(importJob);
            await recordRepo.saveBatch([
                new DataImportRecordEntity({
                    id: `${importId}-primary`,
                    organizationId: validContext.organizationId,
                    importId,
                    rowIndex: 1,
                    rawData: { employee_id: 'EMP001', first_name: 'Ravi', last_name: 'Finance', department: 'Finance' },
                    transformedData: { employee_id: 'EMP001', first_name: 'Ravi', last_name: 'Finance', department: 'Finance' },
                    status: RecordStatus.VALID
                }),
                new DataImportRecordEntity({
                    id: `${importId}-duplicate`,
                    organizationId: validContext.organizationId,
                    importId,
                    rowIndex: 2,
                    rawData: { employee_id: 'EMP001', first_name: 'Ravi', last_name: 'Kumar', department: 'Finance' },
                    transformedData: { employee_id: 'EMP001', first_name: 'Ravi', last_name: 'Kumar', department: 'Finance' },
                    status: RecordStatus.VALID
                })
            ]);
            await service.detectDuplicates(validContext, importId);
        };
        const duplicateImportId = 'imp-dup-edited-duplicate';
        await createDuplicateImport(duplicateImportId);
        const duplicate = await recordRepo.findById(validContext.organizationId, `${duplicateImportId}-duplicate`);
        assert.ok(duplicate);
        duplicate.rawData = { ...duplicate.rawData, employee_id: 'EMP002' };
        duplicate.transformedData = { ...duplicate.transformedData, employee_id: 'EMP002' };
        await recordRepo.saveBatch([duplicate]);
        const duplicateRescan = await service.detectDuplicates(validContext, duplicateImportId);
        const editedDuplicate = await recordRepo.findById(validContext.organizationId, `${duplicateImportId}-duplicate`);
        assert.equal(duplicateRescan.duplicateGroups.length, 0);
        assert.equal(editedDuplicate?.isDuplicate, false);
        assert.equal(editedDuplicate?.matchClassification, MatchClassification.NEW);
        assert.equal(editedDuplicate?.executionAction, ExecutionIntentAction.CREATE);
        assert.equal(editedDuplicate?.transformedData?.employee_id, 'EMP002');
        const primaryImportId = 'imp-dup-edited-primary';
        await createDuplicateImport(primaryImportId);
        const primary = await recordRepo.findById(validContext.organizationId, `${primaryImportId}-primary`);
        assert.ok(primary);
        primary.rawData = { ...primary.rawData, employee_id: 'EMP003' };
        primary.transformedData = { ...primary.transformedData, employee_id: 'EMP003' };
        await recordRepo.saveBatch([primary]);
        const primaryRescan = await service.detectDuplicates(validContext, primaryImportId);
        const editedPrimary = await recordRepo.findById(validContext.organizationId, `${primaryImportId}-primary`);
        const otherRecord = await recordRepo.findById(validContext.organizationId, `${primaryImportId}-duplicate`);
        assert.equal(primaryRescan.duplicateGroups.length, 0);
        assert.equal(editedPrimary?.isDuplicate, false);
        assert.equal(editedPrimary?.executionAction, ExecutionIntentAction.CREATE);
        assert.equal(editedPrimary?.transformedData?.employee_id, 'EMP003');
        assert.equal(otherRecord?.isDuplicate, false);
        assert.equal(otherRecord?.executionAction, ExecutionIntentAction.CREATE);
        assert.equal(otherRecord?.transformedData?.employee_id, 'EMP001');
    });
    it('keeps an edited primary unresolved when it still matches its duplicate', async () => {
        const importJob = new DataImportEntity({
            id: 'imp-dup-primary-still-conflicts',
            organizationId: validContext.organizationId,
            name: 'Primary Duplicate Conflict',
            targetModule: 'hr',
            targetEntity: 'employees',
            sourceType: ImportSourceType.FILE_UPLOAD,
            status: ImportStatus.VALIDATED,
            createdBy: validContext.userId,
            importOptions: {
                duplicateStrategy: DuplicateStrategy.UPDATE,
                errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
            }
        });
        await importRepo.create(importJob);
        await recordRepo.saveBatch([
            new DataImportRecordEntity({
                id: 'imp-dup-primary-still-conflicts-primary',
                organizationId: validContext.organizationId,
                importId: importJob.id,
                rowIndex: 1,
                rawData: { employee_id: 'EMP001', first_name: 'Ravi', last_name: 'Finance', department: 'Finance' },
                transformedData: { employee_id: 'EMP001', first_name: 'Ravi', last_name: 'Finance', department: 'Finance' },
                status: RecordStatus.VALID
            }),
            new DataImportRecordEntity({
                id: 'imp-dup-primary-still-conflicts-duplicate',
                organizationId: validContext.organizationId,
                importId: importJob.id,
                rowIndex: 2,
                rawData: { employee_id: 'EMP001', first_name: 'Ravi', last_name: 'Kumar', department: 'Finance' },
                transformedData: { employee_id: 'EMP001', first_name: 'Ravi', last_name: 'Kumar', department: 'Finance' },
                status: RecordStatus.VALID
            })
        ]);
        await service.detectDuplicates(validContext, importJob.id);
        const unresolved = await service.resolveRecord(validContext, importJob.id, 'imp-dup-primary-still-conflicts-primary', 'EDIT');
        const primary = await recordRepo.findById(validContext.organizationId, 'imp-dup-primary-still-conflicts-primary');
        assert.equal(primary?.executionAction, ExecutionIntentAction.REVIEW);
        assert.equal(primary?.isDuplicate, false);
        assert.equal(unresolved.reviews, 2);
        assert.equal(unresolved.recordResolution?.resolved, false);
        assert.equal(unresolved.duplicateGroups[0]?.status, 'REQUIRES_RESOLUTION');
        assert.match(primary?.blockedReason || '', /still match source row 2/);
    });
    it('never auto-updates a database match from an in-file duplicate row', async () => {
        contactsProvider.seedRecords(validContext.organizationId, [
            { id: 'target-hybrid-contact', email: 'hybrid@corp.com', first_name: 'Ravi', last_name: 'Original' }
        ]);
        const importJob = new DataImportEntity({
            id: 'imp-dup-hybrid-primary',
            organizationId: validContext.organizationId,
            name: 'Hybrid Duplicate Resolution',
            targetModule: 'crm',
            targetEntity: 'contacts',
            sourceType: ImportSourceType.FILE_UPLOAD,
            status: ImportStatus.VALIDATED,
            createdBy: validContext.userId,
            importOptions: {
                duplicateStrategy: DuplicateStrategy.UPDATE,
                errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
            }
        });
        await importRepo.create(importJob);
        await recordRepo.saveBatch([
            new DataImportRecordEntity({
                id: 'imp-dup-hybrid-primary-row',
                organizationId: validContext.organizationId,
                importId: importJob.id,
                rowIndex: 1,
                rawData: { email: 'hybrid@corp.com', first_name: 'Ravi', last_name: 'Primary' },
                transformedData: { email: 'hybrid@corp.com', first_name: 'Ravi', last_name: 'Primary' },
                status: RecordStatus.VALID
            }),
            new DataImportRecordEntity({
                id: 'imp-dup-hybrid-duplicate-row',
                organizationId: validContext.organizationId,
                importId: importJob.id,
                rowIndex: 2,
                rawData: { email: 'hybrid@corp.com', first_name: 'Ravi', last_name: 'Duplicate' },
                transformedData: { email: 'hybrid@corp.com', first_name: 'Ravi', last_name: 'Duplicate' },
                status: RecordStatus.VALID
            })
        ]);
        const summary = await service.detectDuplicates(validContext, importJob.id);
        const primary = await recordRepo.findById(validContext.organizationId, 'imp-dup-hybrid-primary-row');
        const duplicate = await recordRepo.findById(validContext.organizationId, 'imp-dup-hybrid-duplicate-row');
        assert.equal(summary.duplicateGroups[0]?.type, 'HYBRID_MATCH');
        assert.equal(primary?.executionAction, ExecutionIntentAction.UPDATE);
        assert.equal(primary?.targetRecordId, 'target-hybrid-contact');
        assert.equal(duplicate?.executionAction, ExecutionIntentAction.REVIEW);
        assert.equal(duplicate?.isBlocked, true);
        assert.match(duplicate?.blockedReason || '', /requires user resolution/);
        assert.equal(duplicate?.targetRecordId, 'target-hybrid-contact');
    });
    it('keeps actual in-file duplicates unresolved until the user chooses an action', async () => {
        const importJob = new DataImportEntity({
            id: 'imp-dup-default-skip',
            organizationId: validContext.organizationId,
            name: 'Default Duplicate Exclusion',
            targetModule: 'crm',
            targetEntity: 'contacts',
            sourceType: ImportSourceType.FILE_UPLOAD,
            status: ImportStatus.VALIDATED,
            createdBy: validContext.userId,
            importOptions: {
                duplicateStrategy: DuplicateStrategy.SEND_FOR_REVIEW,
                errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
            }
        });
        await importRepo.create(importJob);
        await recordRepo.saveBatch([
            new DataImportRecordEntity({
                id: 'rec-default-primary',
                organizationId: validContext.organizationId,
                importId: importJob.id,
                rowIndex: 1,
                rawData: { email: 'same@corp.com', first_name: 'Primary', last_name: 'Person' },
                transformedData: { email: 'same@corp.com', first_name: 'Primary', last_name: 'Person' },
                status: RecordStatus.VALID
            }),
            new DataImportRecordEntity({
                id: 'rec-default-duplicate',
                organizationId: validContext.organizationId,
                importId: importJob.id,
                rowIndex: 2,
                rawData: { email: 'same@corp.com', first_name: 'Duplicate', last_name: 'Person' },
                transformedData: { email: 'same@corp.com', first_name: 'Duplicate', last_name: 'Person' },
                status: RecordStatus.VALID
            })
        ]);
        const summary = await service.detectDuplicates(validContext, importJob.id, DuplicateStrategy.SEND_FOR_REVIEW);
        const duplicate = await recordRepo.findById(validContext.organizationId, 'rec-default-duplicate');
        const groupDuplicate = summary.duplicateGroups[0].records.find((item) => item.recordId === 'rec-default-duplicate');
        assert.equal(summary.reviews, 1);
        assert.equal(summary.unresolved, 1);
        assert.equal(summary.skips, 0);
        assert.equal(duplicate?.status, RecordStatus.REQUIRES_REVIEW);
        assert.equal(duplicate?.executionAction, ExecutionIntentAction.REVIEW);
        assert.equal(groupDuplicate?.resolutionAction, ExecutionIntentAction.REVIEW);
        const resolved = await service.resolveRecord(validContext, importJob.id, 'rec-default-duplicate', 'REJECT');
        assert.equal(resolved.rejected, 1);
        const rejectedDuplicate = await recordRepo.findById(validContext.organizationId, 'rec-default-duplicate');
        assert.equal(rejectedDuplicate?.status, RecordStatus.REJECTED);
    });
    it('advertises current primary/duplicate actions while preserving legacy resolution requests', async () => {
        const importJob = new DataImportEntity({
            id: 'imp-primary-actions',
            organizationId: validContext.organizationId,
            name: 'Primary duplicate actions',
            targetModule: 'crm',
            targetEntity: 'contacts',
            sourceType: ImportSourceType.FILE_UPLOAD,
            status: ImportStatus.VALIDATED,
            createdBy: validContext.userId,
            importOptions: {
                duplicateStrategy: DuplicateStrategy.SEND_FOR_REVIEW,
                errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
            }
        });
        await importRepo.create(importJob);
        await recordRepo.saveBatch([
            new DataImportRecordEntity({
                id: 'rec-primary-actions',
                organizationId: validContext.organizationId,
                importId: importJob.id,
                rowIndex: 1,
                rawData: { email: 'primary-actions@corp.com', first_name: 'Primary', last_name: 'One' },
                transformedData: { email: 'primary-actions@corp.com', first_name: 'Primary', last_name: 'One' },
                status: RecordStatus.VALID
            }),
            new DataImportRecordEntity({
                id: 'rec-primary-actions-duplicate',
                organizationId: validContext.organizationId,
                importId: importJob.id,
                rowIndex: 2,
                rawData: { email: 'primary-actions@corp.com', first_name: 'Duplicate', last_name: 'Two' },
                transformedData: { email: 'primary-actions@corp.com', first_name: 'Duplicate', last_name: 'Two' },
                status: RecordStatus.VALID
            })
        ]);
        const detected = await service.detectDuplicates(validContext, importJob.id);
        assert.equal(detected.duplicateGroups.length, 1);
        assert.equal(detected.duplicateGroups[0].records.length, 2);
        assert.deepEqual(detected.duplicateGroups[0].records[0].availableActions, ['EDIT']);
        assert.deepEqual(detected.duplicateGroups[0].records[1].availableActions, ['SKIP', 'EDIT']);
        const skipped = await service.resolveRecord(validContext, importJob.id, 'rec-primary-actions', 'SKIP');
        assert.equal(skipped.skips, 1);
        const rejected = await service.resolveRecord(validContext, importJob.id, 'rec-primary-actions', 'REJECT');
        assert.equal(rejected.rejected, 1);
        const primary = await recordRepo.findById(validContext.organizationId, 'rec-primary-actions');
        assert.equal(primary?.executionAction, ExecutionIntentAction.REJECT);
        const rescanned = await service.detectDuplicates(validContext, importJob.id);
        assert.equal(rescanned.rejected, 1);
        assert.equal(rescanned.duplicateGroups.length, 1);
    });
});
//# sourceMappingURL=duplicate-service.test.js.map