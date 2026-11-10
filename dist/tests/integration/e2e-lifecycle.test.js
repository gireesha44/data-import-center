/**
 * Comprehensive End-to-End Lifecycle Integration Test
 * Full 12-Stage Pipeline: Create -> Upload -> Parse -> Map -> Transform -> Validate -> Match -> Review -> Approve -> Execute -> Reconcile -> Report
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../../app.js';
import { InMemoryDataImportRepository } from '../../infrastructure/repositories/in-memory-data-import.repository.js';
import { InMemoryDataImportMappingRepository } from '../../infrastructure/repositories/in-memory-data-import-mapping.repository.js';
import { InMemoryDataImportRecordRepository } from '../../infrastructure/repositories/in-memory-data-import-record.repository.js';
import { InMemoryDataImportApprovalRepository } from '../../infrastructure/repositories/in-memory-data-import-approval.repository.js';
import { InMemoryDataImportExecutionRepository } from '../../infrastructure/repositories/in-memory-data-import-execution.repository.js';
import { InMemoryDataImportReconciliationRepository } from '../../infrastructure/repositories/in-memory-data-import-reconciliation.repository.js';
import { InMemoryTargetMatchProvider, TargetMatchProviderRegistry } from '../../infrastructure/matching/in-memory-target-match.provider.js';
import { ImportStatus } from '../../core/types/import.types.js';
import { ReconciliationStatus } from '../../core/types/reconciliation.types.js';
describe('End-to-End Full Lifecycle Integration Test', () => {
    let server;
    let port;
    let baseUrl;
    const orgId = 'org-e2e-production';
    const uploaderUserId = 'user-e2e-uploader';
    const approverUserId = 'user-e2e-approver';
    const uploaderHeaders = {
        'Content-Type': 'application/json',
        'x-organization-id': orgId,
        'x-user-id': uploaderUserId,
        'x-user-roles': 'user,operator',
        'x-user-permissions': 'DATA_IMPORT_CREATE,DATA_IMPORT_UPLOAD,DATA_IMPORT_MAP,DATA_IMPORT_VALIDATE,DATA_IMPORT_VIEW,DATA_IMPORT_EXECUTE'
    };
    const approverHeaders = {
        'Content-Type': 'application/json',
        'x-organization-id': orgId,
        'x-user-id': approverUserId,
        'x-user-roles': 'admin,sales_manager',
        'x-user-permissions': 'DATA_IMPORT_VIEW,DATA_IMPORT_APPROVE,DATA_IMPORT_EXECUTE'
    };
    let importRepo;
    let mappingRepo;
    let recordRepo;
    let approvalRepo;
    let execRepo;
    let reconRepo;
    let targetRegistry;
    let contactsProvider;
    before(async () => {
        importRepo = new InMemoryDataImportRepository();
        mappingRepo = new InMemoryDataImportMappingRepository();
        recordRepo = new InMemoryDataImportRecordRepository();
        approvalRepo = new InMemoryDataImportApprovalRepository();
        execRepo = new InMemoryDataImportExecutionRepository();
        reconRepo = new InMemoryDataImportReconciliationRepository();
        targetRegistry = new TargetMatchProviderRegistry();
        contactsProvider = new InMemoryTargetMatchProvider('contacts');
        targetRegistry.registerProvider(contactsProvider);
        // Seed 1 existing target record for UPDATE matching
        contactsProvider.seedRecords(orgId, [
            { id: 'target-e2e-sam', email: 'sam@e2e-test.com', first_name: 'Sam', last_name: 'OldName' }
        ]);
        const app = createApp({
            repository: importRepo,
            mappingRepository: mappingRepo,
            recordRepository: recordRepo,
            approvalRepository: approvalRepo,
            executionRepository: execRepo,
            reconciliationRepository: reconRepo,
            targetProviderRegistry: targetRegistry
        });
        await new Promise((resolve) => {
            server = createServer(app);
            server.listen(0, '127.0.0.1', () => {
                const addr = server.address();
                port = addr.port;
                baseUrl = `http://127.0.0.1:${port}/api/v1/data-imports`;
                resolve();
            });
        });
    });
    after(async () => {
        await new Promise((resolve) => {
            server.close(() => resolve());
        });
    });
    it('should execute the complete 12-stage import pipeline from upload to reconciliation and reporting', async () => {
        // 1. CREATE DRAFT IMPORT
        const createRes = await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: uploaderHeaders,
            body: JSON.stringify({
                name: 'E2E Full Pipeline Contacts Import',
                targetModule: 'crm',
                targetEntity: 'contacts',
                sourceType: 'FILE_UPLOAD',
                importOptions: {
                    duplicateStrategy: 'UPDATE',
                    errorStrategy: 'CONTINUE_ON_ERROR'
                }
            })
        });
        assert.equal(createRes.status, 201);
        const createdJson = (await createRes.json());
        const importId = createdJson.data.id;
        assert.ok(importId);
        // 2. UPLOAD FILE CONTENT
        const csvContent = [
            'First Name,Last Name,Email Address,Phone',
            'Diana,Prince,diana@e2e-test.com,+1-555-0101',
            'Sam,NewName,sam@e2e-test.com,+1-555-0102',
            'Duplicate,Row,diana@e2e-test.com,+1-555-0101'
        ].join('\n');
        const uploadRes = await fetch(`${baseUrl}/${importId}/upload`, {
            method: 'POST',
            headers: uploaderHeaders,
            body: JSON.stringify({
                filename: 'contacts_e2e.csv',
                content: Buffer.from(csvContent, 'utf-8').toString('base64'),
                encoding: 'base64',
                mimeType: 'text/csv'
            })
        });
        assert.equal(uploadRes.status, 200);
        // 3. PARSE FILE
        const parseRes = await fetch(`${baseUrl}/${importId}/parse`, {
            method: 'POST',
            headers: uploaderHeaders,
            body: JSON.stringify({})
        });
        assert.equal(parseRes.status, 200);
        const parseJson = (await parseRes.json());
        assert.equal(parseJson.data.rowCount, 3);
        // 4. CONFIGURE COLUMN MAPPING
        const mapRes = await fetch(`${baseUrl}/${importId}/mapping`, {
            method: 'POST',
            headers: uploaderHeaders,
            body: JSON.stringify({
                columnMappings: {
                    'First Name': { targetField: 'first_name', mappingMethod: 'MANUAL', enabled: true },
                    'Last Name': { targetField: 'last_name', mappingMethod: 'MANUAL', enabled: true },
                    'Email Address': { targetField: 'email', mappingMethod: 'MANUAL', enabled: true },
                    'Phone': { targetField: 'phone', mappingMethod: 'MANUAL', enabled: true }
                }
            })
        });
        assert.equal(mapRes.status, 200);
        // 5. VALIDATE & STAGE RECORDS
        const valRes = await fetch(`${baseUrl}/${importId}/validate`, {
            method: 'POST',
            headers: uploaderHeaders,
            body: JSON.stringify({})
        });
        assert.equal(valRes.status, 200);
        const valJson = (await valRes.json());
        assert.equal(valJson.data.validRows, 3);
        assert.equal(valJson.data.invalidRows, 0);
        // 6. DETECT DUPLICATES & MATCH
        const dupRes = await fetch(`${baseUrl}/${importId}/detect-duplicates`, {
            method: 'POST',
            headers: uploaderHeaders,
            body: JSON.stringify({})
        });
        assert.equal(dupRes.status, 200);
        const dupJson = (await dupRes.json());
        assert.equal(dupJson.data.newRecords, 1); // Diana
        assert.equal(dupJson.data.existingRecords, 1); // Sam (in target)
        assert.equal(dupJson.data.duplicateInFile, 1); // Duplicate Diana
        // 7. PRE-EXECUTION REVIEW & CHECKLIST
        const revRes = await fetch(`${baseUrl}/${importId}/review`, {
            method: 'GET',
            headers: uploaderHeaders
        });
        assert.equal(revRes.status, 200);
        const revJson = (await revRes.json());
        assert.equal(revJson.data.requiresApproval, true); // Contacts requires approval by policy
        // 8. SUBMIT, THEN APPROVE (By assigned business role, not uploader)
        const submitRes = await fetch(`${baseUrl}/${importId}/submit-approval`, {
            method: 'POST',
            headers: uploaderHeaders,
            body: JSON.stringify({})
        });
        assert.equal(submitRes.status, 200);
        const appRes = await fetch(`${baseUrl}/${importId}/approve`, {
            method: 'POST',
            headers: approverHeaders,
            body: JSON.stringify({
                decision: 'APPROVE',
                reason: 'E2E Full Pipeline Pre-Approved'
            })
        });
        assert.equal(appRes.status, 200);
        // 9. BATCH EXECUTE
        const execRes = await fetch(`${baseUrl}/${importId}/execute`, {
            method: 'POST',
            headers: uploaderHeaders,
            body: JSON.stringify({ batchSize: 500 })
        });
        assert.equal(execRes.status, 200);
        const execJson = (await execRes.json());
        assert.equal(execJson.data.successfulCreates, 1);
        assert.equal(execJson.data.successfulUpdates, 1);
        assert.equal(execJson.data.skippedRecords, 1);
        // 10. POST-EXECUTION RECONCILE
        const reconRes = await fetch(`${baseUrl}/${importId}/reconcile`, {
            method: 'POST',
            headers: uploaderHeaders,
            body: JSON.stringify({})
        });
        assert.equal(reconRes.status, 200);
        const reconJson = (await reconRes.json());
        assert.equal(reconJson.data.status, ReconciliationStatus.FULLY_RECONCILED);
        assert.equal(reconJson.data.mismatchCount, 0);
        // 11. GET FINAL RECONCILED REPORT
        const reportRes = await fetch(`${baseUrl}/${importId}/report`, {
            method: 'GET',
            headers: uploaderHeaders
        });
        assert.equal(reportRes.status, 200);
        const reportJson = (await reportRes.json());
        assert.equal(reportJson.data.importInfo.status, ImportStatus.COMPLETED);
        assert.equal(reportJson.data.reconciliation.isFullyReconciled, true);
        assert.equal(reportJson.data.execution.created, 1);
        assert.equal(reportJson.data.execution.updated, 1);
        assert.equal(reportJson.data.execution.skipped, 1);
        // 12. EXPORT FINAL REPORT (CSV) & FORMULA INJECTION DEFENSE CHECK
        const exportRes = await fetch(`${baseUrl}/${importId}/report/export?format=csv`, {
            method: 'GET',
            headers: uploaderHeaders
        });
        assert.equal(exportRes.status, 200);
        const csvExport = await exportRes.text();
        assert.ok(csvExport.includes('Section,Metric,Value'));
        assert.ok(csvExport.includes('Import Overview,Entity,contacts'));
        assert.ok(csvExport.includes('Reconciliation & Performance,Reconciliation,FULLY_RECONCILED'));
        // Check target provider data
        const samRecord = await contactsProvider.getRecord(orgId, 'target-e2e-sam');
        assert.equal(samRecord?.last_name, 'NewName');
    });
});
//# sourceMappingURL=e2e-lifecycle.test.js.map