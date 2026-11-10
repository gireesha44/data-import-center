/**
 * Integration Tests: Import Schema Template HTTP APIs
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../app.js';
describe('Import Schema Template APIs (Integration)', () => {
    let server;
    let baseUrl;
    before(async () => {
        const app = createApp();
        await new Promise((resolve) => {
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
        await new Promise((resolve) => {
            server.close(() => resolve());
        });
    });
    const authHeaders = {
        'Content-Type': 'application/json',
        'x-organization-id': 'org_test_100',
        'x-user-id': 'user_tester'
    };
    it('GET /api/v1/data-imports/entities/contacts/template should return template metadata', async () => {
        const res = await fetch(`${baseUrl}/api/v1/data-imports/entities/contacts/template`, {
            headers: authHeaders
        });
        assert.equal(res.status, 200);
        const body = (await res.json());
        assert.equal(body.success, true);
        assert.equal(body.data.entity, 'contacts');
        assert.equal(body.data.module, 'crm');
        assert.equal(body.data.requiredCount, 3);
        assert.deepEqual(body.data.requiredFields, ['first_name', 'last_name', 'email']);
        // Verify system ID is excluded
        assert.equal(body.data.fields.some((f) => f.name === 'id'), false);
    });
    it('GET /api/v1/data-imports/entities/contacts/template/download?format=csv should return CSV file', async () => {
        const res = await fetch(`${baseUrl}/api/v1/data-imports/entities/contacts/template/download?format=csv`, {
            headers: authHeaders
        });
        assert.equal(res.status, 200);
        assert.ok(res.headers.get('content-type')?.includes('text/csv'));
        assert.ok(res.headers.get('content-disposition')?.includes('contacts_import_template.csv'));
        const csvText = await res.text();
        const lines = csvText.trim().split('\n');
        assert.ok(lines.length >= 2);
        assert.equal(lines[0], 'first_name,last_name,email,phone,company,status');
    });
    it('GET /api/v1/data-imports/entities/contacts/template/download?format=xlsx should return XLSX spreadsheet', async () => {
        const res = await fetch(`${baseUrl}/api/v1/data-imports/entities/contacts/template/download?format=xlsx`, {
            headers: authHeaders
        });
        assert.equal(res.status, 200);
        assert.ok(res.headers.get('content-type')?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
        assert.ok(res.headers.get('content-disposition')?.includes('contacts_import_template.xlsx'));
        const arrayBuffer = await res.arrayBuffer();
        assert.ok(arrayBuffer.byteLength > 0);
    });
    it('GET /api/v1/data-imports/entities/nonexistent/template should return 404 Not Found', async () => {
        const res = await fetch(`${baseUrl}/api/v1/data-imports/entities/nonexistent/template`, {
            headers: authHeaders
        });
        assert.equal(res.status, 404);
    });
});
//# sourceMappingURL=template-api.test.js.map