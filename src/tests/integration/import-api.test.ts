/**
 * Integration Tests: Data Import HTTP APIs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { createApp } from '../../app.js';
import { InMemoryDataImportRepository } from '../../infrastructure/repositories/in-memory-data-import.repository.js';
import { ImportStatus } from '../../core/types/import.types.js';

describe('Data Import HTTP APIs (Integration)', () => {
  let server: Server;
  let baseUrl: string;
  let repository: InMemoryDataImportRepository;

  before(async () => {
    repository = new InMemoryDataImportRepository();
    const app = createApp({ repository });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
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

  const authHeaders = {
    'Content-Type': 'application/json',
    'x-organization-id': 'org_test_100',
    'x-user-id': 'user_tester'
  };

  it('GET /health should return 200 OK', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.status, 'OK');
    assert.equal(body.service, 'data-import-center');
  });

  it('POST /api/v1/data-imports should create draft import and return 201 Created', async () => {
    const payload = {
      name: 'Integration Test Import',
      targetModule: 'crm',
      targetEntity: 'contacts',
      importOptions: {
        batchSize: 200
      }
    };

    const res = await fetch(`${baseUrl}/api/v1/data-imports`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 201);
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.equal(body.data.name, 'Integration Test Import');
    assert.equal(body.data.status, ImportStatus.DRAFT);
    assert.equal(body.data.organizationId, 'org_test_100');
  });

  it('POST /api/v1/data-imports with missing required fields should return 400 Bad Request with standardized error details', async () => {
    const payload = {
      name: '',
      targetEntity: 'contacts'
    };

    const res = await fetch(`${baseUrl}/api/v1/data-imports`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 400);
    const body = await res.json() as any;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(body.error.details));
  });

  it('GET /api/v1/data-imports should return paginated list of imports for tenant', async () => {
    const res = await fetch(`${baseUrl}/api/v1/data-imports?page=1&limit=10`, {
      headers: authHeaders
    });

    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.meta.pagination.total >= 1);
  });

  it('GET /api/v1/data-imports/:id should return 200 for existing import and 404 for unknown ID', async () => {
    // 1. Create one
    const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Lookup Import',
        targetEntity: 'contacts'
      })
    });
    const createBody = await createRes.json() as any;
    const importId = createBody.data.id;

    // 2. Lookup existing
    const getRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}`, {
      headers: authHeaders
    });
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json() as any;
    assert.equal(getBody.data.id, importId);

    // 3. Lookup non-existent
    const notFoundRes = await fetch(`${baseUrl}/api/v1/data-imports/unknown-id-000`, {
      headers: authHeaders
    });
    assert.equal(notFoundRes.status, 404);
    const notFoundBody = await notFoundRes.json() as any;
    assert.equal(notFoundBody.success, false);
    assert.equal(notFoundBody.error.code, 'NOT_FOUND');
  });

  it('PATCH /api/v1/data-imports/:id should update draft import', async () => {
    const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Initial Name',
        targetEntity: 'contacts'
      })
    });
    const createBody = await createRes.json() as any;
    const importId = createBody.data.id;

    const patchRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Patched Import Name'
      })
    });

    assert.equal(patchRes.status, 200);
    const patchBody = await patchRes.json() as any;
    assert.equal(patchBody.data.name, 'Patched Import Name');
    assert.equal(patchBody.data.version, 2);
  });

  it('POST /api/v1/data-imports/:id/cancel should cancel draft import', async () => {
    const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Cancel Test Import',
        targetEntity: 'contacts'
      })
    });
    const createBody = await createRes.json() as any;
    const importId = createBody.data.id;

    const cancelRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/cancel`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        reason: 'Integration test abort'
      })
    });

    assert.equal(cancelRes.status, 200);
    const cancelBody = await cancelRes.json() as any;
    assert.equal(cancelBody.data.status, ImportStatus.CANCELLED);
  });

  it('POST /api/v1/data-imports without DATA_IMPORT_CREATE permission should return 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/v1/data-imports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-organization-id': 'org_test_100',
        'x-user-id': 'user_readonly',
        'x-permissions': 'data_import:view' // Lacks create permission
      },
      body: JSON.stringify({
        name: 'Forbidden Import',
        targetEntity: 'contacts'
      })
    });

    assert.equal(res.status, 403);
    const body = await res.json() as any;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });
});
