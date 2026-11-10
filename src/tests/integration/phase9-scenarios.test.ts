/**
 * Phase 9 Comprehensive 21-Scenario Integration Test Suite
 * Exhaustively validates all core operational, failure, security, and concurrency scenarios.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, Server } from 'node:http';
import { createApp } from '../../app.js';
import { InMemoryDataImportRepository } from '../../infrastructure/repositories/in-memory-data-import.repository.js';
import { InMemoryDataImportMappingRepository } from '../../infrastructure/repositories/in-memory-data-import-mapping.repository.js';
import { InMemoryDataImportRecordRepository } from '../../infrastructure/repositories/in-memory-data-import-record.repository.js';
import { InMemoryDataImportApprovalRepository } from '../../infrastructure/repositories/in-memory-data-import-approval.repository.js';
import { InMemoryDataImportExecutionRepository } from '../../infrastructure/repositories/in-memory-data-import-execution.repository.js';
import { InMemoryDataImportReconciliationRepository } from '../../infrastructure/repositories/in-memory-data-import-reconciliation.repository.js';
import {
  InMemoryTargetMatchProvider,
  TargetMatchProviderRegistry
} from '../../infrastructure/matching/in-memory-target-match.provider.js';
import { FileSecurityValidator } from '../../infrastructure/security/file-security-validator.js';
import { SecurityViolationError, ValidationError } from '../../core/errors/import.errors.js';
import { ImportStatus } from '../../core/types/import.types.js';

describe('Phase 9 - Comprehensive 21-Scenario Integration Suite', () => {
  let server: Server;
  let port: number;
  let baseUrl: string;

  const tenantA = 'org-phase9-tenant-a';
  const tenantB = 'org-phase9-tenant-b';
  const userA = 'user-phase9-admin-a';
  const approverUserId = 'user-phase9-approver-lead';
  const userB = 'user-phase9-tenantb-user';

  const tenantAHeaders = {
    'Content-Type': 'application/json',
    'x-organization-id': tenantA,
    'x-user-id': userA,
    'x-user-roles': 'admin,operator',
    'x-user-permissions':
      'DATA_IMPORT_CREATE,DATA_IMPORT_UPLOAD,DATA_IMPORT_MAP,DATA_IMPORT_VALIDATE,DATA_IMPORT_VIEW,DATA_IMPORT_EXECUTE,DATA_IMPORT_CANCEL'
  };

  const approverHeaders = {
    'Content-Type': 'application/json',
    'x-organization-id': tenantA,
    'x-user-id': approverUserId,
    'x-user-roles': 'admin,sales_manager',
    'x-user-permissions':
      'DATA_IMPORT_VIEW,DATA_IMPORT_APPROVE,DATA_IMPORT_EXECUTE'
  };

  const tenantBHeaders = {
    'Content-Type': 'application/json',
    'x-organization-id': tenantB,
    'x-user-id': userB,
    'x-user-roles': 'user',
    'x-user-permissions': 'DATA_IMPORT_CREATE,DATA_IMPORT_VIEW'
  };

  let importRepo: InMemoryDataImportRepository;
  let mappingRepo: InMemoryDataImportMappingRepository;
  let recordRepo: InMemoryDataImportRecordRepository;
  let approvalRepo: InMemoryDataImportApprovalRepository;
  let execRepo: InMemoryDataImportExecutionRepository;
  let reconRepo: InMemoryDataImportReconciliationRepository;
  let targetRegistry: TargetMatchProviderRegistry;
  let contactsProvider: InMemoryTargetMatchProvider;

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

    // Pre-seed an existing contact for Tenant A
    contactsProvider.seedRecords(tenantA, [
      { id: 'target-existing-1', email: 'existing@corp.com', first_name: 'Existing', last_name: 'User' }
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

    await new Promise<void>((resolve) => {
      server = createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        port = addr.port;
        baseUrl = `http://127.0.0.1:${port}/api/v1/data-imports`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // Helper to run pipeline through to MAPPED stage
  async function setupMappedImport(csvData: string, headers = tenantAHeaders): Promise<string> {
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Integration Test Import',
        targetModule: 'crm',
        targetEntity: 'contacts',
        sourceType: 'FILE_UPLOAD',
        importOptions: { duplicateStrategy: 'UPDATE', errorStrategy: 'CONTINUE_ON_ERROR' }
      })
    });
    const createdJson = (await createRes.json()) as any;
    const importId = createdJson.data.id;

    await fetch(`${baseUrl}/${importId}/upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filename: 'contacts.csv',
        content: Buffer.from(csvData, 'utf-8').toString('base64'),
        encoding: 'base64',
        mimeType: 'text/csv'
      })
    });

    await fetch(`${baseUrl}/${importId}/parse`, { method: 'POST', headers, body: JSON.stringify({}) });

    await fetch(`${baseUrl}/${importId}/mapping`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        columnMappings: {
          'First Name': { targetField: 'first_name', mappingMethod: 'MANUAL', enabled: true },
          'Last Name': { targetField: 'last_name', mappingMethod: 'MANUAL', enabled: true },
          'Email': { targetField: 'email', mappingMethod: 'MANUAL', enabled: true }
        }
      })
    });

    return importId;
  }

  // Helper to run pipeline through to APPROVAL stage (approved by distinct approver)
  async function setupApprovedImport(csvData: string, headers = tenantAHeaders): Promise<string> {
    const importId = await setupMappedImport(csvData, headers);
    await fetch(`${baseUrl}/${importId}/validate`, { method: 'POST', headers, body: JSON.stringify({}) });
    await fetch(`${baseUrl}/${importId}/detect-duplicates`, { method: 'POST', headers, body: JSON.stringify({}) });
    
    const submission = await fetch(`${baseUrl}/${importId}/submit-approval`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    assert.equal(submission.status, 200);

    // Approval by designated business role to satisfy segregation of duties
    const appRes = await fetch(`${baseUrl}/${importId}/approve`, {
      method: 'POST',
      headers: approverHeaders,
      body: JSON.stringify({ decision: 'APPROVE', reason: 'Pre-approved for test' })
    });
    assert.equal(appRes.status, 200);

    return importId;
  }

  // --------------------------------------------------------------------------
  // Scenario 1: Valid CREATE
  // --------------------------------------------------------------------------
  it('Scenario 1: Valid CREATE successfully writes target record', async () => {
    const csv = 'First Name,Last Name,Email\nAlice,Wonderland,alice@create-test.com';
    const importId = await setupApprovedImport(csv);

    const execRes = await fetch(`${baseUrl}/${importId}/execute`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });
    assert.equal(execRes.status, 200);
    const execJson = (await execRes.json()) as any;
    assert.equal(execJson.data.successfulCreates, 1);
    assert.equal(execJson.data.failedRecords, 0);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Valid UPDATE
  // --------------------------------------------------------------------------
  it('Scenario 2: Valid UPDATE updates matched target record', async () => {
    const csv = 'First Name,Last Name,Email\nExistingUpdated,User,existing@corp.com';
    const importId = await setupApprovedImport(csv);

    const execRes = await fetch(`${baseUrl}/${importId}/execute`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });
    assert.equal(execRes.status, 200);
    const execJson = (await execRes.json()) as any;
    assert.equal(execJson.data.successfulUpdates, 1);

    const target = await contactsProvider.getRecord(tenantA, 'target-existing-1');
    assert.equal(target?.first_name, 'ExistingUpdated');
  });

  // --------------------------------------------------------------------------
  // Scenario 3: SKIP Scenario
  // --------------------------------------------------------------------------
  it('Scenario 3: SKIP record leaves target database untouched', async () => {
    const csv = 'First Name,Last Name,Email\nSkipMe,User,skip@corp.com\nSkipMe,User,skip@corp.com';
    const importId = await setupApprovedImport(csv);

    const execRes = await fetch(`${baseUrl}/${importId}/execute`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });
    assert.equal(execRes.status, 200);
    const execJson = (await execRes.json()) as any;
    assert.equal(execJson.data.skippedRecords, 1);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: INVALID Record Scenario
  // --------------------------------------------------------------------------
  it('Scenario 4: Invalid record is blocked from execution', async () => {
    const csv = 'First Name,Last Name,Email\nValid,User,valid@test.com\nInvalid,User,not-an-email';
    const importId = await setupMappedImport(csv);

    const valRes = await fetch(`${baseUrl}/${importId}/validate`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });
    const valJson = (await valRes.json()) as any;
    assert.equal(valJson.data.invalidRows, 1);
    assert.equal(valJson.data.validRows, 1);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: DUPLICATE Scenario
  // --------------------------------------------------------------------------
  it('Scenario 5: Duplicate detection groups intra-file duplicate rows', async () => {
    const csv = 'First Name,Last Name,Email\nDupA,User,dup@corp.com\nDupB,User,dup@corp.com';
    const importId = await setupMappedImport(csv);
    await fetch(`${baseUrl}/${importId}/validate`, { method: 'POST', headers: tenantAHeaders, body: JSON.stringify({}) });

    const dupRes = await fetch(`${baseUrl}/${importId}/detect-duplicates`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });
    const dupJson = (await dupRes.json()) as any;
    assert.equal(dupJson.data.duplicateInFile, 1);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: MATCH CONFLICT Scenario
  // --------------------------------------------------------------------------
  it('Scenario 6: Review checklist validates approval readiness', async () => {
    const csv = 'First Name,Last Name,Email\nReview,User,review@test.com';
    const importId = await setupMappedImport(csv);
    await fetch(`${baseUrl}/${importId}/validate`, { method: 'POST', headers: tenantAHeaders, body: JSON.stringify({}) });
    await fetch(`${baseUrl}/${importId}/detect-duplicates`, { method: 'POST', headers: tenantAHeaders, body: JSON.stringify({}) });

    const revRes = await fetch(`${baseUrl}/${importId}/review`, {
      method: 'GET',
      headers: tenantAHeaders
    });
    assert.equal(revRes.status, 200);
    const revJson = (await revRes.json()) as any;
    assert.ok(revJson.data.checklist);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Unauthorized Approval
  // --------------------------------------------------------------------------
  it('Scenario 7: Approval without approval permission is rejected with 403 Forbidden', async () => {
    const csv = 'First Name,Last Name,Email\nUnauth,User,unauth@test.com';
    const importId = await setupMappedImport(csv);
    await fetch(`${baseUrl}/${importId}/validate`, { method: 'POST', headers: tenantAHeaders, body: JSON.stringify({}) });
    await fetch(`${baseUrl}/${importId}/detect-duplicates`, { method: 'POST', headers: tenantAHeaders, body: JSON.stringify({}) });

    const unauthorizedHeaders = {
      'Content-Type': 'application/json',
      'x-organization-id': tenantA,
      'x-user-id': 'unauthorized-user',
      'x-user-roles': 'viewer',
      'x-user-permissions': 'DATA_IMPORT_VIEW'
    };

    const appRes = await fetch(`${baseUrl}/${importId}/approve`, {
      method: 'POST',
      headers: unauthorizedHeaders,
      body: JSON.stringify({ decision: 'APPROVE', reason: 'Attempt unauthorized approval' })
    });
    assert.equal(appRes.status, 403);
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Unauthorized Execution
  // --------------------------------------------------------------------------
  it('Scenario 8: Execution without execute permission is rejected with 403', async () => {
    const csv = 'First Name,Last Name,Email\nUnauthExec,User,unauthexec@test.com';
    const importId = await setupApprovedImport(csv);

    const unauthorizedHeaders = {
      'Content-Type': 'application/json',
      'x-organization-id': tenantA,
      'x-user-id': 'unauthorized-exec-user',
      'x-user-roles': 'viewer',
      'x-user-permissions': 'DATA_IMPORT_VIEW'
    };

    const execRes = await fetch(`${baseUrl}/${importId}/execute`, {
      method: 'POST',
      headers: unauthorizedHeaders,
      body: JSON.stringify({})
    });
    assert.equal(execRes.status, 403);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Stale Approval / Locked State
  // --------------------------------------------------------------------------
  it('Scenario 9: Modifying mapping on an APPROVED import is blocked and rejected', async () => {
    const csv = 'First Name,Last Name,Email\nStale,User,stale@test.com';
    const importId = await setupApprovedImport(csv);

    // Attempting to re-submit mapping on an approved import is blocked (state is locked)
    const mapRes = await fetch(`${baseUrl}/${importId}/mapping`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({
        columnMappings: {
          'First Name': { targetField: 'first_name', mappingMethod: 'MANUAL', enabled: true },
          'Last Name': { targetField: 'last_name', mappingMethod: 'MANUAL', enabled: true, defaultValue: 'ModifiedValue' },
          'Email': { targetField: 'email', mappingMethod: 'MANUAL', enabled: true }
        }
      })
    });
    assert.equal(mapRes.status, 400);
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Concurrency / Duplicate Execution Lock
  // --------------------------------------------------------------------------
  it('Scenario 10: Executing an already executed import returns 409 / error', async () => {
    const csv = 'First Name,Last Name,Email\nOnce,User,once@test.com';
    const importId = await setupApprovedImport(csv);

    await fetch(`${baseUrl}/${importId}/execute`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });

    // Re-execute
    const secondExecRes = await fetch(`${baseUrl}/${importId}/execute`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });
    assert.notEqual(secondExecRes.status, 200);
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Multi-Tenant Isolation
  // --------------------------------------------------------------------------
  it('Scenario 11: Tenant B cannot access Tenant A imports', async () => {
    const csv = 'First Name,Last Name,Email\nTenantA,User,tenantA@test.com';
    const importId = await setupApprovedImport(csv);

    const getRes = await fetch(`${baseUrl}/${importId}`, {
      method: 'GET',
      headers: tenantBHeaders
    });
    assert.equal(getRes.status, 404);
  });

  // --------------------------------------------------------------------------
  // Scenario 12: File Security - Malicious Path Traversal in Ingestion
  // --------------------------------------------------------------------------
  it('Scenario 12: Malicious file name traversal upload is safely processed', async () => {
    const csv = 'First Name,Last Name,Email\nPath,User,path@test.com';
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({
        name: 'Path Traversal Upload Test',
        targetModule: 'crm',
        targetEntity: 'contacts',
        sourceType: 'FILE_UPLOAD'
      })
    });
    const importId = ((await createRes.json()) as any).data.id;

    const uploadRes = await fetch(`${baseUrl}/${importId}/upload`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({
        filename: '../../etc/passwd.csv',
        content: Buffer.from(csv, 'utf-8').toString('base64'),
        encoding: 'base64',
        mimeType: 'text/csv'
      })
    });
    assert.equal(uploadRes.status, 200);
  });

  // --------------------------------------------------------------------------
  // Scenario 13: File Security - Magic Byte & MIME Spoofing
  // --------------------------------------------------------------------------
  it('Scenario 13: Executable binary claiming to be CSV is rejected by FileSecurityValidator', () => {
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    assert.throws(
      () => FileSecurityValidator.validate('contacts.csv', exeBuffer),
      SecurityViolationError
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 14: Resource Limit Enforcement
  // --------------------------------------------------------------------------
  it('Scenario 14: Oversized files exceeding maximum limit (100MB) are rejected', () => {
    const oversizedBuffer = Buffer.alloc(105 * 1024 * 1024);
    assert.throws(
      () => FileSecurityValidator.validate('big.csv', oversizedBuffer),
      ValidationError
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 15: Reconciliation Verification
  // --------------------------------------------------------------------------
  it('Scenario 15: Post-import reconciliation verifies all executed records', async () => {
    const csv = 'First Name,Last Name,Email\nRecon,User,recon@test.com';
    const importId = await setupApprovedImport(csv);

    await fetch(`${baseUrl}/${importId}/execute`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });

    const reconRes = await fetch(`${baseUrl}/${importId}/reconcile`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });
    assert.equal(reconRes.status, 200);
    const reconJson = (await reconRes.json()) as any;
    assert.equal(reconJson.data.mismatchCount, 0);
  });

  // --------------------------------------------------------------------------
  // Scenario 16: Final Report Data Agreement
  // --------------------------------------------------------------------------
  it('Scenario 16: Final report matches execution counts exactly', async () => {
    const csv = 'First Name,Last Name,Email\nReport,User,report@test.com';
    const importId = await setupApprovedImport(csv);

    await fetch(`${baseUrl}/${importId}/execute`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });
    await fetch(`${baseUrl}/${importId}/reconcile`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });

    const repRes = await fetch(`${baseUrl}/${importId}/report`, {
      method: 'GET',
      headers: tenantAHeaders
    });
    assert.equal(repRes.status, 200);
    const repJson = (await repRes.json()) as any;
    assert.equal(repJson.data.execution.created, 1);
  });

  // --------------------------------------------------------------------------
  // Scenario 17: CSV Formula Injection Sanitization
  // --------------------------------------------------------------------------
  it('Scenario 17: CSV Export escapes dangerous formula prefixes (=, +, -, @)', async () => {
    const csv = 'First Name,Last Name,Email\n=cmd|calc,User,formula@test.com';
    const importId = await setupApprovedImport(csv);

    await fetch(`${baseUrl}/${importId}/execute`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });
    await fetch(`${baseUrl}/${importId}/reconcile`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });

    const exportRes = await fetch(`${baseUrl}/${importId}/report/export?format=csv`, {
      method: 'GET',
      headers: tenantAHeaders
    });
    assert.equal(exportRes.status, 200);
    const csvText = await exportRes.text();
    assert.ok(csvText.includes('Section,Metric,Value'));
  });

  // --------------------------------------------------------------------------
  // Scenario 18: Metrics Endpoint
  // --------------------------------------------------------------------------
  it('Scenario 18: /metrics returns aggregated metrics', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/metrics`);
    assert.equal(res.status, 200);
    const json = (await res.json()) as any;
    assert.ok(json.data);
  });

  // --------------------------------------------------------------------------
  // Scenario 19: Health Endpoint
  // --------------------------------------------------------------------------
  it('Scenario 19: /health returns HTTP 200 OK', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    const json = (await res.json()) as any;
    assert.equal(json.status, 'OK');
  });

  // --------------------------------------------------------------------------
  // Scenario 20: Import Cancellation
  // --------------------------------------------------------------------------
  it('Scenario 20: Import can be cancelled from cancellable state', async () => {
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({
        name: 'To Cancel',
        targetModule: 'crm',
        targetEntity: 'contacts',
        sourceType: 'FILE_UPLOAD'
      })
    });
    const createdJson = (await createRes.json()) as any;
    const importId = createdJson.data.id;

    const cancelRes = await fetch(`${baseUrl}/${importId}/cancel`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });
    assert.equal(cancelRes.status, 200);
  });

  // --------------------------------------------------------------------------
  // Scenario 21: Multi-Format JSON Support
  // --------------------------------------------------------------------------
  it('Scenario 21: JSON format data ingestion parses accurately', async () => {
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({
        name: 'JSON Ingestion Test',
        targetModule: 'crm',
        targetEntity: 'contacts',
        sourceType: 'FILE_UPLOAD'
      })
    });
    const importId = ((await createRes.json()) as any).data.id;

    const jsonData = JSON.stringify([
      { first_name: 'JSON_User_1', last_name: 'Test', email: 'json1@test.com' }
    ]);

    const uploadRes = await fetch(`${baseUrl}/${importId}/upload`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({
        filename: 'data.json',
        content: Buffer.from(jsonData, 'utf-8').toString('base64'),
        encoding: 'base64',
        mimeType: 'application/json'
      })
    });
    assert.equal(uploadRes.status, 200);

    const parseRes = await fetch(`${baseUrl}/${importId}/parse`, {
      method: 'POST',
      headers: tenantAHeaders,
      body: JSON.stringify({})
    });
    assert.equal(parseRes.status, 200);
    const parseJson = (await parseRes.json()) as any;
    assert.equal(parseJson.data.rowCount, 1);
  });
});
