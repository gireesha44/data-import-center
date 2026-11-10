/**
 * Integration Tests: Entity Schema Discovery & Column Mapping HTTP APIs
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../app.js';
describe('Mapping & Schema Registry HTTP APIs (Integration)', () => {
    let server;
    let baseUrl;
    const authHeaders = {
        'Content-Type': 'application/json',
        'x-organization-id': 'org_acme_corp',
        'x-user-id': 'user_admin_01',
        'x-user-roles': 'ADMIN',
        'x-user-permissions': 'DATA_IMPORT_VIEW,DATA_IMPORT_CREATE,DATA_IMPORT_UPLOAD,DATA_IMPORT_VALIDATE,DATA_IMPORT_MAP,DATA_IMPORT_CANCEL'
    };
    before(async () => {
        const app = createApp();
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
    it('GET /api/v1/data-imports/entities - should discover importable entities', async () => {
        const res = await fetch(`${baseUrl}/api/v1/data-imports/entities`, {
            method: 'GET',
            headers: authHeaders
        });
        assert.equal(res.status, 200);
        const body = (await res.json());
        assert.equal(body.success, true);
        assert.ok(Array.isArray(body.data));
        assert.ok(body.data.some((e) => e.entity === 'contacts'));
        assert.ok(body.data.some((e) => e.entity === 'products'));
        assert.ok(body.data.some((e) => e.entity === 'invoices'));
    });
    it('GET /api/v1/data-imports/entities/:entity - should return entity schema details', async () => {
        const res = await fetch(`${baseUrl}/api/v1/data-imports/entities/contacts`, {
            method: 'GET',
            headers: authHeaders
        });
        assert.equal(res.status, 200);
        const body = (await res.json());
        assert.equal(body.success, true);
        assert.equal(body.data.entity, 'contacts');
        assert.ok(body.data.fields['first_name']);
        assert.ok(body.data.fields['email']);
        assert.equal(body.data.fields['email'].type, 'EMAIL');
    });
    it('Complete Flow: Create -> Upload -> Parse -> Suggestions -> Save Mapping -> Validate', async () => {
        // 1. Create Import
        const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                name: 'CRM Customers Ingestion',
                targetEntity: 'contacts'
            })
        });
        assert.equal(createRes.status, 201);
        const createBody = (await createRes.json());
        const importId = createBody.data.id;
        // 2. Upload CSV File
        const csvContent = `First Name,Last Name,Email Address,Phone Number\nAlice,Smith,alice.smith@corp.com,+1-555-0101\nBob,Jones,bob.jones@corp.com,+1-555-0102`;
        const uploadRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/upload`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                filename: 'contacts.csv',
                content: csvContent,
                encoding: 'utf-8'
            })
        });
        assert.equal(uploadRes.status, 200);
        // 3. Parse CSV File
        const parseRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/parse`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({})
        });
        assert.equal(parseRes.status, 200);
        // 4. Get Mapping Suggestions
        const sugRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/mapping/suggestions`, {
            method: 'GET',
            headers: authHeaders
        });
        assert.equal(sugRes.status, 200);
        const sugBody = (await sugRes.json());
        assert.equal(sugBody.data.totalSourceColumns, 4);
        assert.equal(sugBody.data.mappedCount, 4);
        // 5. Validate Candidate Mapping
        const valRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/mapping/validate`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                columnMappings: {
                    'First Name': { targetField: 'first_name' },
                    'Last Name': { targetField: 'last_name' },
                    'Email Address': { targetField: 'email' },
                    'Phone Number': { targetField: 'phone' }
                }
            })
        });
        assert.equal(valRes.status, 200);
        const valBody = (await valRes.json());
        assert.equal(valBody.data.isValid, true);
        assert.equal(valBody.data.unmappedRequiredFields.length, 0);
        // 6. Save Mapping
        const saveRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/mapping`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                columnMappings: {
                    'First Name': { targetField: 'first_name', mappingMethod: 'MANUAL' },
                    'Last Name': { targetField: 'last_name', mappingMethod: 'MANUAL' },
                    'Email Address': { targetField: 'email', mappingMethod: 'MANUAL' },
                    'Phone Number': { targetField: 'phone', mappingMethod: 'MANUAL' }
                }
            })
        });
        assert.equal(saveRes.status, 200);
        const saveBody = (await saveRes.json());
        assert.equal(saveBody.data.isValid, true);
        // 7. Get Saved Mapping
        const getMapRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/mapping`, {
            method: 'GET',
            headers: authHeaders
        });
        assert.equal(getMapRes.status, 200);
        const getMapBody = (await getMapRes.json());
        assert.ok(getMapBody.data.columnMappings['First Name']);
        // 8. Verify Import status is now MAPPED
        const getJobRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}`, {
            method: 'GET',
            headers: authHeaders
        });
        const jobBody = (await getJobRes.json());
        assert.equal(jobBody.data.status, 'MAPPED');
    });
    it('Multi-Tenant Isolation: Tenant B cannot view or save mappings for Tenant A', async () => {
        // 1. Create import for Tenant A
        const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                name: 'Tenant A Secret Import',
                targetEntity: 'products'
            })
        });
        const createBody = (await createRes.json());
        const importId = createBody.data.id;
        // 2. Tenant B attempts to get mapping suggestions
        const tenantBHeaders = {
            'Content-Type': 'application/json',
            'x-organization-id': 'org_competitor_b',
            'x-user-id': 'user_b',
            'x-user-roles': 'ADMIN',
            'x-user-permissions': 'DATA_IMPORT_VIEW,DATA_IMPORT_MAP'
        };
        const sugRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/mapping/suggestions`, {
            method: 'GET',
            headers: tenantBHeaders
        });
        assert.equal(sugRes.status, 404);
        // 3. Tenant B attempts to save mapping
        const saveRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/mapping`, {
            method: 'POST',
            headers: tenantBHeaders,
            body: JSON.stringify({
                columnMappings: { sku: { targetField: 'sku' } }
            })
        });
        assert.equal(saveRes.status, 404);
    });
});
//# sourceMappingURL=mapping-api.test.js.map