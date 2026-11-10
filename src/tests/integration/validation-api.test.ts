/**
 * Integration Tests: Multi-Tier Validation & Staged Records HTTP APIs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { createApp } from '../../app.js';

describe('Validation & Staging HTTP APIs (Integration)', () => {
  let server: Server;
  let baseUrl: string;

  const authHeaders = {
    'Content-Type': 'application/json',
    'x-organization-id': 'org_acme_corp',
    'x-user-id': 'user_admin_01',
    'x-user-roles': 'ADMIN',
    'x-user-permissions':
      'DATA_IMPORT_VIEW,DATA_IMPORT_CREATE,DATA_IMPORT_UPLOAD,DATA_IMPORT_VALIDATE,DATA_IMPORT_MAP,DATA_IMPORT_CANCEL'
  };

  before(async () => {
    const app = createApp();
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

  it('Complete End-to-End Pipeline: Create -> Upload -> Parse -> Map -> Validate -> Validation Preview', async () => {
    // 1. Create Import Job
    const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Invoices Integration Pipeline',
        targetEntity: 'invoices'
      })
    });
    assert.equal(createRes.status, 201);
    const createBody = (await createRes.json()) as any;
    const importId = createBody.data.id;

    // 2. Upload CSV with valid, warning, and invalid records
    const csvContent = `Invoice Num,Customer,Amount,Issue Date,Due Date
INV-1001,customer1@example.com,150.00,2026-05-01,2026-05-31
INV-1002,customer2@example.com,150000.00,2026-05-01,2026-05-31
INV-1003,bad-email,200.00,2026-05-31,2026-05-01`;

    const uploadRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/upload`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        filename: 'invoices.csv',
        content: csvContent,
        encoding: 'utf-8'
      })
    });
    assert.equal(uploadRes.status, 200);

    // 3. Parse File
    const parseRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/parse`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({})
    });
    assert.equal(parseRes.status, 200);

    // 4. Save Mapping
    const saveMappingRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/mapping`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        columnMappings: {
          'Invoice Num': { targetField: 'invoice_number' },
          'Customer': { targetField: 'customer_email' },
          'Amount': { targetField: 'total_amount' },
          'Issue Date': { targetField: 'issue_date' },
          'Due Date': { targetField: 'due_date' }
        }
      })
    });
    assert.equal(saveMappingRes.status, 200);

    // 5. Trigger Validation
    const valRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/validate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dryRun: false
      })
    });
    assert.equal(valRes.status, 200);
    const valBody = (await valRes.json()) as any;
    assert.equal(valBody.success, true);
    assert.equal(valBody.data.totalRows, 3);
    assert.equal(valBody.data.validRows, 1); // row 1 (VALID)
    assert.equal(valBody.data.warningRows, 1); // row 2 (WARNING)
    assert.equal(valBody.data.invalidRows, 1); // row 3 (INVALID)

    // Verify Import State is VALIDATION_FAILED due to row 3 invalid
    const getJobRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}`, {
      method: 'GET',
      headers: authHeaders
    });
    const jobBody = (await getJobRes.json()) as any;
    assert.equal(jobBody.data.status, 'VALIDATION_FAILED');

    // 6. Query Validation Preview
    const previewRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/validation-preview?limit=10`, {
      method: 'GET',
      headers: authHeaders
    });
    assert.equal(previewRes.status, 200);
    const previewBody = (await previewRes.json()) as any;
    assert.equal(previewBody.success, true);
    assert.equal(previewBody.data.length, 3);

    // Verify row 1 is VALID
    const row1 = previewBody.data.find((r: any) => r.rowIndex === 1);
    assert.equal(row1.status, 'VALID');
    assert.equal(row1.transformedData.invoice_number, 'INV-1001');

    // Verify row 2 is WARNING (due to high value invoice business rule)
    const row2 = previewBody.data.find((r: any) => r.rowIndex === 2);
    assert.equal(row2.status, 'WARNING');
    assert.ok(row2.validationErrors.some((i: any) => i.code === 'HIGH_VALUE_INVOICE'));

    // Verify row 3 is INVALID
    const row3 = previewBody.data.find((r: any) => r.rowIndex === 3);
    assert.equal(row3.status, 'INVALID');
    assert.ok(row3.validationErrors.some((i: any) => i.code === 'INVALID_EMAIL_FORMAT'));
    assert.ok(row3.validationErrors.some((i: any) => i.code === 'INVALID_DATE_RANGE'));
  });

  it('Multi-Tenant Isolation: Tenant B cannot trigger validation on Tenant A import', async () => {
    // 1. Create import for Tenant A
    const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Tenant A Validation Target',
        targetEntity: 'contacts'
      })
    });
    const createBody = (await createRes.json()) as any;
    const importId = createBody.data.id;

    // 2. Tenant B attempts to validate Tenant A import
    const tenantBHeaders = {
      'Content-Type': 'application/json',
      'x-organization-id': 'org_competitor_b',
      'x-user-id': 'user_b',
      'x-user-roles': 'ADMIN',
      'x-user-permissions': 'DATA_IMPORT_VIEW,DATA_IMPORT_VALIDATE'
    };

    const valRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/validate`, {
      method: 'POST',
      headers: tenantBHeaders,
      body: JSON.stringify({})
    });
    assert.equal(valRes.status, 404);

    const prevRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/validation-preview`, {
      method: 'GET',
      headers: tenantBHeaders
    });
    assert.equal(prevRes.status, 404);
  });
});
