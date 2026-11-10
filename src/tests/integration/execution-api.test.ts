/**
 * End-to-End Review, Approval & Execution HTTP APIs Integration Tests
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { createApp } from '../../app.js';
import { InMemoryDataImportRepository } from '../../infrastructure/repositories/in-memory-data-import.repository.js';
import { InMemoryDataImportRecordRepository } from '../../infrastructure/repositories/in-memory-data-import-record.repository.js';
import { InMemoryDataImportMappingRepository } from '../../infrastructure/repositories/in-memory-data-import-mapping.repository.js';
import { InMemoryDataImportApprovalRepository } from '../../infrastructure/repositories/in-memory-data-import-approval.repository.js';
import { InMemoryDataImportExecutionRepository } from '../../infrastructure/repositories/in-memory-data-import-execution.repository.js';
import {
  InMemoryTargetMatchProvider,
  TargetMatchProviderRegistry
} from '../../infrastructure/matching/in-memory-target-match.provider.js';

describe('Review, Approval & Batch Execution HTTP APIs (Integration)', () => {
  let server: Server;
  let baseUrl: string;
  let importRepo: InMemoryDataImportRepository;
  let recordRepo: InMemoryDataImportRecordRepository;
  let mappingRepo: InMemoryDataImportMappingRepository;
  let approvalRepo: InMemoryDataImportApprovalRepository;
  let executionRepo: InMemoryDataImportExecutionRepository;
  let targetRegistry: TargetMatchProviderRegistry;
  let productsProvider: InMemoryTargetMatchProvider;

  const orgA = 'org-integration-exec';
  const uploaderUser = 'user_uploader_1';
  const approverUser = 'user_manager_2';

  const uploaderHeaders = {
    'Content-Type': 'application/json',
    'x-user-id': uploaderUser,
    'x-organization-id': orgA,
    'x-user-roles': 'operator',
    'x-user-permissions':
      'DATA_IMPORT_VIEW,DATA_IMPORT_CREATE,DATA_IMPORT_UPLOAD,DATA_IMPORT_VALIDATE,DATA_IMPORT_MAP,DATA_IMPORT_EXECUTE'
  };

  const approverHeaders = {
    'Content-Type': 'application/json',
    'x-user-id': approverUser,
    'x-organization-id': orgA,
    'x-user-roles': 'manager',
    'x-user-permissions':
      'DATA_IMPORT_VIEW,DATA_IMPORT_APPROVE,DATA_IMPORT_EXECUTE'
  };

  before(async () => {
    importRepo = new InMemoryDataImportRepository();
    recordRepo = new InMemoryDataImportRecordRepository();
    mappingRepo = new InMemoryDataImportMappingRepository();
    approvalRepo = new InMemoryDataImportApprovalRepository();
    executionRepo = new InMemoryDataImportExecutionRepository();
    targetRegistry = new TargetMatchProviderRegistry();
    productsProvider = new InMemoryTargetMatchProvider('products');
    targetRegistry.registerProvider(productsProvider);

    const app = createApp({
      repository: importRepo,
      recordRepository: recordRepo,
      mappingRepository: mappingRepo,
      approvalRepository: approvalRepo,
      executionRepository: executionRepo,
      targetProviderRegistry: targetRegistry
    });

    await new Promise<void>((resolve) => {
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
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    productsProvider.clear();
  });

  it('Complete Lifecycle: Create -> Upload -> Parse -> Map -> Validate -> Match -> Review -> Approve -> Execute', async () => {
    // 0. Seed 1 existing product in target system for UPDATE testing
    productsProvider.seedRecords(orgA, [
      { id: 'target-prod-100', sku: 'PROD-100', name: 'Legacy Keyboard', price: 49.99, stock_quantity: 10 }
    ]);

    // 1. Create Import Job
    const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
      method: 'POST',
      headers: uploaderHeaders,
      body: JSON.stringify({
        name: 'Full E2E Products Pipeline',
        targetEntity: 'products',
        importOptions: {
          duplicateStrategy: 'UPDATE'
        }
      })
    });
    assert.equal(createRes.status, 201);
    const createData = (await createRes.json()) as any;
    const importId = createData.data.id;

    // 2. Upload CSV: 1 new product, 1 existing update product
    const csvContent = `SKU,Product Name,Unit Price,Quantity
PROD-100,Updated Mechanical Keyboard,79.99,25
PROD-200,Wireless Mouse,29.99,50`;

    const uploadRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/upload`, {
      method: 'POST',
      headers: uploaderHeaders,
      body: JSON.stringify({
        filename: 'products.csv',
        content: csvContent
      })
    });
    assert.equal(uploadRes.status, 200);

    // 3. Parse File
    const parseRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/parse`, {
      method: 'POST',
      headers: uploaderHeaders,
      body: JSON.stringify({})
    });
    assert.equal(parseRes.status, 200);

    // 4. Save Column Mapping
    const mapRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/mapping`, {
      method: 'POST',
      headers: uploaderHeaders,
      body: JSON.stringify({
        columnMappings: {
          'SKU': { targetField: 'sku' },
          'Product Name': { targetField: 'name' },
          'Unit Price': { targetField: 'price' },
          'Quantity': { targetField: 'stock_quantity' }
        }
      })
    });
    assert.equal(mapRes.status, 200);

    // 5. Run Validation
    const valRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/validate`, {
      method: 'POST',
      headers: uploaderHeaders,
      body: JSON.stringify({})
    });
    assert.equal(valRes.status, 200);

    // 6. Run Duplicate Detection
    const dupRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/detect-duplicates`, {
      method: 'POST',
      headers: uploaderHeaders,
      body: JSON.stringify({})
    });
    assert.equal(dupRes.status, 200);
    const dupBody = (await dupRes.json()) as any;
    assert.equal(dupBody.data.existingRecords, 1);
    assert.equal(dupBody.data.newRecords, 1);

    // 7. Check Review Summary & Readiness
    const reviewRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/review`, {
      method: 'GET',
      headers: uploaderHeaders
    });
    assert.equal(reviewRes.status, 200);
    const reviewBody = (await reviewRes.json()) as any;
    assert.equal(reviewBody.data.readiness, 'READY');
    assert.equal(reviewBody.data.plannedCreates, 1);
    assert.equal(reviewBody.data.plannedUpdates, 1);

    // Approval is submitted only when the entity's configured policy requires it.
    if (reviewBody.data.requiresApproval) {
      const submitRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/submit-approval`, {
        method: 'POST',
        headers: uploaderHeaders,
        body: JSON.stringify({})
      });
      assert.equal(submitRes.status, 200);
      const approveRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/approve`, {
        method: 'POST',
        headers: approverHeaders,
        body: JSON.stringify({ comment: 'Ready for batch execution' })
      });
      assert.equal(approveRes.status, 200);
    }

    // 9. Execute Import
    const execRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/execute`, {
      method: 'POST',
      headers: uploaderHeaders,
      body: JSON.stringify({})
    });
    assert.equal(execRes.status, 200);
    const execBody = (await execRes.json()) as any;
    assert.equal(execBody.data.status, 'COMPLETED');
    assert.equal(execBody.data.successfulCreates, 1);
    assert.equal(execBody.data.successfulUpdates, 1);
    assert.equal(execBody.data.failedRecords, 0);

    // 10. Verify Target Database Mutations
    const updatedLegacy = await productsProvider.getRecord(orgA, 'target-prod-100');
    assert.equal(updatedLegacy?.name, 'Updated Mechanical Keyboard');
    assert.equal(updatedLegacy?.price, 79.99);

    // 11. Verify Execution Status endpoint
    const statusRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/execution`, {
      method: 'GET',
      headers: uploaderHeaders
    });
    assert.equal(statusRes.status, 200);
    const statusBody = (await statusRes.json()) as any;
    assert.equal(statusBody.data.status, 'COMPLETED');
  });
});
