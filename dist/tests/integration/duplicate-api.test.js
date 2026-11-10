/**
 * Duplicate Detection and Match Preview REST APIs Integration Tests
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../app.js';
import { InMemoryDataImportRepository } from '../../infrastructure/repositories/in-memory-data-import.repository.js';
import { InMemoryDataImportRecordRepository } from '../../infrastructure/repositories/in-memory-data-import-record.repository.js';
import { InMemoryDataImportMappingRepository } from '../../infrastructure/repositories/in-memory-data-import-mapping.repository.js';
import { InMemoryTargetMatchProvider, TargetMatchProviderRegistry } from '../../infrastructure/matching/in-memory-target-match.provider.js';
import { DataImportEntity } from '../../domain/entities/data-import.entity.js';
import { DataImportRecordEntity } from '../../domain/entities/data-import-record.entity.js';
import { DataImportMappingEntity } from '../../domain/entities/data-import-mapping.entity.js';
import { ImportStatus, ImportSourceType, DuplicateStrategy, ErrorStrategy, RecordStatus } from '../../core/types/import.types.js';
describe('Duplicate Detection & Matching HTTP APIs (Integration)', () => {
    let server;
    let baseUrl;
    let importRepo;
    let recordRepo;
    let mappingRepo;
    let targetRegistry;
    let contactsProvider;
    const orgA = 'org-tenant-alpha';
    const orgB = 'org-tenant-bravo';
    const userA = 'user-alpha-1';
    const authHeadersA = {
        'Content-Type': 'application/json',
        'x-user-id': userA,
        'x-organization-id': orgA,
        'x-user-roles': 'admin',
        'x-user-permissions': 'DATA_IMPORT_VALIDATE,DATA_IMPORT_VIEW,DATA_IMPORT_CREATE'
    };
    before(async () => {
        importRepo = new InMemoryDataImportRepository();
        recordRepo = new InMemoryDataImportRecordRepository();
        mappingRepo = new InMemoryDataImportMappingRepository();
        targetRegistry = new TargetMatchProviderRegistry();
        contactsProvider = new InMemoryTargetMatchProvider('contacts');
        targetRegistry.registerProvider(contactsProvider);
        const app = createApp({
            repository: importRepo,
            mappingRepository: mappingRepo,
            recordRepository: recordRepo,
            targetProviderRegistry: targetRegistry
        });
        await new Promise((resolve) => {
            server = app.listen(0, () => {
                const address = server.address();
                if (address && typeof address === 'object') {
                    baseUrl = `http://127.0.0.1:${address.port}`;
                }
                resolve();
            });
        });
    });
    after(async () => {
        await new Promise((resolve) => {
            server.close(() => resolve());
        });
    });
    beforeEach(() => {
        contactsProvider.clear();
    });
    it('POST /api/v1/data-imports/:id/detect-duplicates should execute matching and return summary', async () => {
        // Seed Target system for Tenant Alpha
        contactsProvider.seedRecords(orgA, [
            { id: 'target-contact-alpha-1', email: 'existing@corp.com', first_name: 'Existing', last_name: 'Corp' }
        ]);
        // Create Import Job for Tenant Alpha
        const importJob = new DataImportEntity({
            id: 'imp-int-dup-1',
            organizationId: orgA,
            name: 'Integration Duplicate Import',
            targetModule: 'crm',
            targetEntity: 'contacts',
            sourceType: ImportSourceType.FILE_UPLOAD,
            status: ImportStatus.VALIDATED,
            createdBy: userA,
            importOptions: {
                duplicateStrategy: DuplicateStrategy.UPDATE,
                errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
            }
        });
        await importRepo.create(importJob);
        // Seed Staged Records
        const records = [
            new DataImportRecordEntity({
                id: 'rec-1',
                organizationId: orgA,
                importId: 'imp-int-dup-1',
                rowIndex: 1,
                rawData: { email: 'existing@corp.com', first_name: 'Existing', last_name: 'Corp' },
                transformedData: { email: 'existing@corp.com', first_name: 'Existing', last_name: 'Corp' },
                status: RecordStatus.VALID
            }),
            new DataImportRecordEntity({
                id: 'rec-2',
                organizationId: orgA,
                importId: 'imp-int-dup-1',
                rowIndex: 2,
                rawData: { email: 'newuser@corp.com', first_name: 'New', last_name: 'User' },
                transformedData: { email: 'newuser@corp.com', first_name: 'New', last_name: 'User' },
                status: RecordStatus.VALID
            })
        ];
        await recordRepo.saveBatch(records);
        const res = await fetch(`${baseUrl}/api/v1/data-imports/imp-int-dup-1/detect-duplicates`, {
            method: 'POST',
            headers: authHeadersA,
            body: JSON.stringify({})
        });
        assert.equal(res.status, 200);
        const body = (await res.json());
        assert.equal(body.success, true);
        assert.equal(body.data.totalRecords, 2);
        assert.equal(body.data.existingRecords, 1);
        assert.equal(body.data.newRecords, 1);
        assert.equal(body.data.updates, 1);
        assert.equal(body.data.creates, 1);
        assert.equal(body.data.duplicateGroups.length, 0, 'Single incoming matches are not duplicate groups');
        const resolveRes = await fetch(`${baseUrl}/api/v1/data-imports/imp-int-dup-1/resolve-duplicate-record`, {
            method: 'POST',
            headers: authHeadersA,
            body: JSON.stringify({ recordId: 'rec-1', action: 'UPDATE' })
        });
        assert.equal(resolveRes.status, 200);
        const resolveBody = (await resolveRes.json());
        assert.equal(resolveBody.data.updates, 1);
        assert.equal(resolveBody.data.skips, 0);
    });
    it('GET /api/v1/data-imports/:id/match-preview should support filtering by classification', async () => {
        // Seed Target system for Tenant Alpha
        contactsProvider.seedRecords(orgA, [
            { id: 'target-contact-alpha-1', email: 'matched@corp.com', first_name: 'Matched', last_name: 'User' }
        ]);
        const importJob = new DataImportEntity({
            id: 'imp-int-preview-1',
            organizationId: orgA,
            name: 'Preview Duplicate Import',
            targetModule: 'crm',
            targetEntity: 'contacts',
            sourceType: ImportSourceType.FILE_UPLOAD,
            status: ImportStatus.VALIDATED,
            createdBy: userA,
            importOptions: {
                duplicateStrategy: DuplicateStrategy.SKIP,
                errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
            }
        });
        await importRepo.create(importJob);
        const records = [
            new DataImportRecordEntity({
                id: 'rec-p1',
                organizationId: orgA,
                importId: 'imp-int-preview-1',
                rowIndex: 1,
                rawData: { email: 'matched@corp.com', first_name: 'Matched', last_name: 'User' },
                transformedData: { email: 'matched@corp.com', first_name: 'Matched', last_name: 'User' },
                status: RecordStatus.VALID
            }),
            new DataImportRecordEntity({
                id: 'rec-p2',
                organizationId: orgA,
                importId: 'imp-int-preview-1',
                rowIndex: 2,
                rawData: { email: 'unique@corp.com', first_name: 'Unique', last_name: 'User' },
                transformedData: { email: 'unique@corp.com', first_name: 'Unique', last_name: 'User' },
                status: RecordStatus.VALID
            })
        ];
        await recordRepo.saveBatch(records);
        // Run duplicate detection
        await fetch(`${baseUrl}/api/v1/data-imports/imp-int-preview-1/detect-duplicates`, {
            method: 'POST',
            headers: authHeadersA,
            body: JSON.stringify({})
        });
        // Filter preview by EXISTING
        const previewRes = await fetch(`${baseUrl}/api/v1/data-imports/imp-int-preview-1/match-preview?classification=EXISTING`, {
            method: 'GET',
            headers: authHeadersA
        });
        assert.equal(previewRes.status, 200);
        const previewBody = (await previewRes.json());
        assert.equal(previewBody.data.length, 1);
        assert.equal(previewBody.data[0].classification, 'EXISTING');
        assert.equal(previewBody.data[0].matchedTargetId, 'target-contact-alpha-1');
    });
    it('allows a validated draft to rescan and regroups an edited row when it matches current values', async () => {
        const importId = 'imp-draft-rescan-current-values';
        await importRepo.create(new DataImportEntity({
            id: importId,
            organizationId: orgA,
            name: 'Draft Duplicate Rescan',
            targetModule: 'crm',
            targetEntity: 'contacts',
            sourceType: ImportSourceType.FILE_UPLOAD,
            status: ImportStatus.VALIDATED,
            createdBy: userA,
            fileMetadata: {
                validationSummary: { totalRows: 3, validRows: 3, invalidRows: 0 }
            },
            importOptions: {
                duplicateStrategy: DuplicateStrategy.SEND_FOR_REVIEW,
                errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
            }
        }));
        await mappingRepo.save(new DataImportMappingEntity({
            id: `map-${importId}`,
            organizationId: orgA,
            importId,
            columnMappings: {
                email: { sourceColumn: 'email', targetField: 'email', targetType: 'EMAIL', required: true },
                first_name: { sourceColumn: 'first_name', targetField: 'first_name', targetType: 'STRING', required: true },
                last_name: { sourceColumn: 'last_name', targetField: 'last_name', targetType: 'STRING', required: true }
            }
        }));
        const stagedRows = [
            { id: `${importId}-1`, email: 'old@corp.com', first_name: 'Original', last_name: 'Person' },
            { id: `${importId}-2`, email: 'old@corp.com', first_name: 'Edited', last_name: 'Person' },
            { id: `${importId}-3`, email: 'current@corp.com', first_name: 'Current', last_name: 'Match' }
        ];
        await recordRepo.saveBatch(stagedRows.map((row, index) => new DataImportRecordEntity({
            id: row.id,
            organizationId: orgA,
            importId,
            rowIndex: index + 1,
            rawData: { email: row.email, first_name: row.first_name, last_name: row.last_name },
            transformedData: { email: row.email, first_name: row.first_name, last_name: row.last_name },
            status: RecordStatus.VALID
        })));
        const scanResponse = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/detect-duplicates`, {
            method: 'POST',
            headers: authHeadersA,
            body: JSON.stringify({ overrideStrategy: 'SEND_FOR_REVIEW' })
        });
        assert.equal(scanResponse.status, 200);
        const firstScan = (await scanResponse.json()).data;
        assert.equal(firstScan.duplicateGroups.length, 1);
        const correctionResponse = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/records/${importId}-2/correct`, {
            method: 'PATCH',
            headers: authHeadersA,
            body: JSON.stringify({ fields: { email: 'current@corp.com' } })
        });
        assert.equal(correctionResponse.status, 200);
        const refreshed = (await correctionResponse.json()).data.duplicateSummary;
        const currentGroup = refreshed.duplicateGroups.find((group) => group.records.some((record) => record.recordId === `${importId}-2`) &&
            group.records.some((record) => record.recordId === `${importId}-3`));
        assert.ok(currentGroup, 'records with the same current match key should be grouped again');
        assert.equal(currentGroup.recordsCount, 2);
        const saveDraftResponse = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/save-draft`, {
            method: 'POST',
            headers: authHeadersA,
            body: JSON.stringify({ currentStep: 5 })
        });
        assert.equal(saveDraftResponse.status, 200);
        const draftRescanResponse = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/detect-duplicates`, {
            method: 'POST',
            headers: authHeadersA,
            body: JSON.stringify({ overrideStrategy: 'SEND_FOR_REVIEW' })
        });
        assert.equal(draftRescanResponse.status, 200);
        const draftRescan = (await draftRescanResponse.json()).data;
        assert.ok(draftRescan.duplicateGroups.some((group) => group.records.some((record) => record.recordId === `${importId}-2`) &&
            group.records.some((record) => record.recordId === `${importId}-3`)));
    });
    it('PATCH correction revalidates and re-detects duplicates for edited primary and duplicate rows', async () => {
        const createImport = async (importId) => {
            const job = new DataImportEntity({
                id: importId,
                organizationId: orgA,
                name: 'Duplicate Edit Revalidation',
                targetModule: 'hr',
                targetEntity: 'contacts',
                fileName: 'employees.csv',
                sourceType: ImportSourceType.FILE_UPLOAD,
                status: ImportStatus.VALIDATED,
                createdBy: userA,
                importOptions: {
                    duplicateStrategy: DuplicateStrategy.UPDATE,
                    errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
                }
            });
            await importRepo.create(job);
            await mappingRepo.save(new DataImportMappingEntity({
                id: `map-${importId}`,
                organizationId: orgA,
                importId,
                columnMappings: {
                    email: { sourceColumn: 'email', targetField: 'email', targetType: 'EMAIL', required: true },
                    first_name: { sourceColumn: 'first_name', targetField: 'first_name', targetType: 'STRING', required: true },
                    last_name: { sourceColumn: 'last_name', targetField: 'last_name', targetType: 'STRING', required: true }
                }
            }));
            await recordRepo.saveBatch([
                new DataImportRecordEntity({
                    id: `${importId}-primary`,
                    organizationId: orgA,
                    importId,
                    rowIndex: 1,
                    rawData: { email: 'same@corp.com', first_name: 'Ravi', last_name: 'Finance' },
                    transformedData: { email: 'same@corp.com', first_name: 'Ravi', last_name: 'Finance' },
                    status: RecordStatus.VALID
                }),
                new DataImportRecordEntity({
                    id: `${importId}-duplicate`,
                    organizationId: orgA,
                    importId,
                    rowIndex: 2,
                    rawData: { email: 'same@corp.com', first_name: 'Ravi', last_name: 'Kumar' },
                    transformedData: { email: 'same@corp.com', first_name: 'Ravi', last_name: 'Kumar' },
                    status: RecordStatus.VALID
                })
            ]);
            const scanResponse = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/detect-duplicates`, {
                method: 'POST',
                headers: authHeadersA,
                body: JSON.stringify({})
            });
            assert.equal(scanResponse.status, 200);
            assert.equal((await scanResponse.json()).data.duplicateGroups.length, 1);
        };
        const editAndAssertUnique = async (importId, editedRecordId, value) => {
            const response = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/records/${editedRecordId}/correct`, {
                method: 'PATCH',
                headers: authHeadersA,
                body: JSON.stringify({ fields: { email: value } })
            });
            assert.equal(response.status, 200);
            const body = await response.json();
            assert.equal(body.data.duplicateSummary.duplicateGroups.length, 0);
            assert.equal(body.data.record.transformedData.email, value);
            const resolutionResponse = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/resolve-duplicate-record`, {
                method: 'POST',
                headers: authHeadersA,
                body: JSON.stringify({ recordId: editedRecordId, action: 'UPDATE' })
            });
            assert.equal(resolutionResponse.status, 200);
            const refreshedSummary = (await resolutionResponse.json()).data;
            assert.equal(refreshedSummary.duplicateGroups.length, 0);
            assert.equal(refreshedSummary.resolvedDuplicateGroups.length, 1);
            assert.equal(refreshedSummary.resolvedDuplicateGroups[0].records[0].recordId, editedRecordId);
            assert.equal(refreshedSummary.recordResolution.resolved, true);
            assert.equal(refreshedSummary.creates, 2);
            assert.equal(refreshedSummary.resolvedUpdates, 1);
            const persistedRecordResponse = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/review/records/${editedRecordId}`, { method: 'GET', headers: authHeadersA });
            assert.equal(persistedRecordResponse.status, 200);
            const persistedRecordBody = await persistedRecordResponse.json();
            assert.equal(persistedRecordBody.data.transformedData.email, value);
            assert.equal(persistedRecordBody.data.executionAction, 'CREATE');
            const persistedRecords = await recordRepo.findByImportId(orgA, importId);
            assert.equal(persistedRecords.data.length, 2, 'editing must not delete the uploaded source rows');
            assert.ok(persistedRecords.data.every((record) => !record.isDuplicate && record.executionAction === 'CREATE'));
            const reviewResponse = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/review`, {
                method: 'GET',
                headers: authHeadersA
            });
            assert.equal(reviewResponse.status, 200);
            const review = (await reviewResponse.json()).data;
            assert.equal(review.plannedCreates, 2);
            assert.equal(review.unresolvedDuplicates, 0);
            assert.equal(review.readinessLabel, 'READY FOR APPROVAL');
        };
        await createImport('imp-edit-rescan-duplicate');
        await editAndAssertUnique('imp-edit-rescan-duplicate', 'imp-edit-rescan-duplicate-duplicate', 'emp002@corp.com');
        await createImport('imp-edit-rescan-primary');
        await editAndAssertUnique('imp-edit-rescan-primary', 'imp-edit-rescan-primary-primary', 'emp003@corp.com');
        const stillDuplicateImportId = 'imp-edit-rescan-still-duplicate';
        await createImport(stillDuplicateImportId);
        const unchangedKeyEdit = await fetch(`${baseUrl}/api/v1/data-imports/${stillDuplicateImportId}/records/${stillDuplicateImportId}-duplicate/correct`, {
            method: 'PATCH',
            headers: authHeadersA,
            body: JSON.stringify({ fields: { last_name: 'Ravi Kumar Edited' } })
        });
        assert.equal(unchangedKeyEdit.status, 200);
        const rescanBody = await unchangedKeyEdit.json();
        assert.equal(rescanBody.data.duplicateSummary.duplicateGroups.length, 1);
        const unresolvedUpdate = await fetch(`${baseUrl}/api/v1/data-imports/${stillDuplicateImportId}/resolve-duplicate-record`, {
            method: 'POST',
            headers: authHeadersA,
            body: JSON.stringify({
                recordId: `${stillDuplicateImportId}-duplicate`,
                action: 'UPDATE'
            })
        });
        assert.equal(unresolvedUpdate.status, 200);
        const unresolvedResolution = (await unresolvedUpdate.json()).data;
        assert.equal(unresolvedResolution.reviews, 1);
        assert.equal(unresolvedResolution.recordResolution.resolved, false);
        const currentGroup = unresolvedResolution.duplicateGroups[0];
        const updatedDuplicate = currentGroup.records.find((record) => record.recordId === `${stillDuplicateImportId}-duplicate`);
        assert.equal(updatedDuplicate.data.last_name, 'Ravi Kumar Edited');
        assert.equal(updatedDuplicate.resolutionAction, 'REVIEW');
        const unresolvedReviewResponse = await fetch(`${baseUrl}/api/v1/data-imports/${stillDuplicateImportId}/review`, { method: 'GET', headers: authHeadersA });
        const unresolvedReview = (await unresolvedReviewResponse.json()).data;
        assert.equal(unresolvedReview.itemsNeedingReview, 1);
        assert.equal(unresolvedReview.unresolvedDuplicates, 1);
        assert.equal(unresolvedReview.readinessLabel, 'ACTION REQUIRED');
    });
    it('Strict Multi-Tenant Isolation: Target records belonging to Tenant B must NEVER match Tenant A imports', async () => {
        // Seed email in Tenant B
        contactsProvider.seedRecords(orgB, [
            { id: 'target-contact-bravo-99', email: 'secret@tenantb.com', first_name: 'Bravo', last_name: 'User' }
        ]);
        // Create import in Tenant A with the same email
        const importJob = new DataImportEntity({
            id: 'imp-tenant-a',
            organizationId: orgA,
            name: 'Tenant A Import',
            targetModule: 'crm',
            targetEntity: 'contacts',
            sourceType: ImportSourceType.FILE_UPLOAD,
            status: ImportStatus.VALIDATED,
            createdBy: userA,
            importOptions: {
                duplicateStrategy: DuplicateStrategy.UPDATE,
                errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
            }
        });
        await importRepo.create(importJob);
        const records = [
            new DataImportRecordEntity({
                id: 'rec-tenant-a-1',
                organizationId: orgA,
                importId: 'imp-tenant-a',
                rowIndex: 1,
                rawData: { email: 'secret@tenantb.com', first_name: 'Test', last_name: 'User' },
                transformedData: { email: 'secret@tenantb.com', first_name: 'Test', last_name: 'User' },
                status: RecordStatus.VALID
            })
        ];
        await recordRepo.saveBatch(records);
        const res = await fetch(`${baseUrl}/api/v1/data-imports/imp-tenant-a/detect-duplicates`, {
            method: 'POST',
            headers: authHeadersA,
            body: JSON.stringify({})
        });
        assert.equal(res.status, 200);
        const body = (await res.json());
        // MUST BE NEW because Tenant B target record is strictly isolated
        assert.equal(body.data.newRecords, 1);
        assert.equal(body.data.existingRecords, 0);
    });
});
//# sourceMappingURL=duplicate-api.test.js.map