/**
 * Integration Tests: File Ingestion, Storage & Parsing APIs
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { createApp } from '../../app.js';
import { InMemoryDataImportRepository } from '../../infrastructure/repositories/in-memory-data-import.repository.js';
import { ImportStatus } from '../../core/types/import.types.js';
describe('File Ingestion & Parsing APIs (Integration)', () => {
    let server;
    let baseUrl;
    let repository;
    before(async () => {
        repository = new InMemoryDataImportRepository();
        const app = createApp({ repository });
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
        'x-organization-id': 'org_ingestion_100',
        'x-user-id': 'user_ingestor'
    };
    it('Complete Flow 1: Create Import -> Upload CSV -> Parse CSV -> Verified State & Dataset', async () => {
        // 1. Create Import Draft
        const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                name: 'CSV Customers Ingestion',
                targetEntity: 'contacts'
            })
        });
        const createBody = await createRes.json();
        const importId = createBody.data.id;
        assert.equal(createBody.data.status, ImportStatus.DRAFT);
        // 2. Upload CSV file
        const csvContent = 'first_name,last_name,email,phone\nJane,Doe,jane@acme.com,+14155550199\nJohn,Smith,john@acme.com,+14155550198';
        const uploadRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/upload`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                filename: 'customers.csv',
                content: csvContent,
                encoding: 'utf-8'
            })
        });
        assert.equal(uploadRes.status, 200);
        const uploadBody = await uploadRes.json();
        assert.equal(uploadBody.data.originalName, 'customers.csv');
        assert.equal(uploadBody.data.detectedFormat, 'CSV');
        // Verify import state transitioned to UPLOADED
        const importAfterUpload = await fetch(`${baseUrl}/api/v1/data-imports/${importId}`, {
            headers: authHeaders
        });
        const afterUploadBody = await importAfterUpload.json();
        assert.equal(afterUploadBody.data.status, ImportStatus.UPLOADED);
        assert.equal(afterUploadBody.data.fileName, 'customers.csv');
        // 3. Trigger Parse
        const parseRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/parse`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                previewLimit: 10
            })
        });
        assert.equal(parseRes.status, 200);
        const parseBody = await parseRes.json();
        assert.equal(parseBody.data.format, 'CSV');
        assert.equal(parseBody.data.rowCount, 2);
        assert.equal(parseBody.data.columnCount, 4);
        assert.deepEqual(parseBody.data.headers, ['first_name', 'last_name', 'email', 'phone']);
        assert.equal(parseBody.data.rows[0].values['first_name'], 'Jane');
        assert.equal(parseBody.data.rows[1].values['email'], 'john@acme.com');
        // Verify import state transitioned to PARSED and totalRecords updated
        const finalImport = await fetch(`${baseUrl}/api/v1/data-imports/${importId}`, {
            headers: authHeaders
        });
        const finalBody = await finalImport.json();
        assert.equal(finalBody.data.status, ImportStatus.PARSED);
        assert.equal(finalBody.data.totalRecords, 2);
    });
    it('Complete Flow 2: Create Import -> Upload Excel (xlsx) -> Parse Sheet -> Normalized Rows', async () => {
        // 1. Create Import Draft
        const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                name: 'Excel Products Ingestion',
                targetEntity: 'products'
            })
        });
        const createBody = await createRes.json();
        const importId = createBody.data.id;
        // 2. Generate Excel Buffer & Base64 encode
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['sku', 'name', 'price', 'category'],
            ['PROD-101', 'Wireless Mouse', 29.99, 'Electronics'],
            ['PROD-102', 'Mechanical Keyboard', 89.99, 'Electronics']
        ]);
        XLSX.utils.book_append_sheet(wb, ws, 'Products');
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const uploadRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/upload`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                filename: 'products.xlsx',
                content: excelBuffer.toString('base64'),
                encoding: 'base64'
            })
        });
        assert.equal(uploadRes.status, 200);
        // 3. Parse Excel
        const parseRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/parse`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                sheet: 'Products'
            })
        });
        assert.equal(parseRes.status, 200);
        const parseBody = await parseRes.json();
        assert.equal(parseBody.data.format, 'XLSX');
        assert.equal(parseBody.data.rowCount, 2);
        assert.equal(parseBody.data.rows[0].values['sku'], 'PROD-101');
        assert.equal(parseBody.data.rows[1].values['name'], 'Mechanical Keyboard');
    });
    it('Complete Flow 3: Create Import -> Upload JSON -> Parse JSON -> Normalized Rows', async () => {
        const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                name: 'JSON Contacts Ingestion',
                targetEntity: 'contacts'
            })
        });
        const createBody = await createRes.json();
        const importId = createBody.data.id;
        const jsonContent = JSON.stringify([
            { first_name: 'David', last_name: 'Clark', email: 'david@clark.io' }
        ]);
        await fetch(`${baseUrl}/api/v1/data-imports/${importId}/upload`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                filename: 'contacts.json',
                content: jsonContent,
                encoding: 'utf-8'
            })
        });
        const parseRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/parse`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({})
        });
        assert.equal(parseRes.status, 200);
        const parseBody = await parseRes.json();
        assert.equal(parseBody.data.format, 'JSON');
        assert.equal(parseBody.data.rowCount, 1);
        assert.equal(parseBody.data.rows[0].values['first_name'], 'David');
    });
    it('Complete Flow 4: Create Import -> Upload XML -> Parse XML -> Normalized Rows', async () => {
        const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                name: 'XML Feed Ingestion',
                targetEntity: 'products'
            })
        });
        const createBody = await createRes.json();
        const importId = createBody.data.id;
        const xmlContent = `<?xml version="1.0"?>
<catalog>
  <product sku="SKU-88">
    <name>USB-C Hub</name>
    <price>45.00</price>
  </product>
</catalog>`;
        await fetch(`${baseUrl}/api/v1/data-imports/${importId}/upload`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                filename: 'feed.xml',
                content: xmlContent,
                encoding: 'utf-8'
            })
        });
        const parseRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/parse`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({})
        });
        assert.equal(parseRes.status, 200);
        const parseBody = await parseRes.json();
        assert.equal(parseBody.data.format, 'XML');
        assert.equal(parseBody.data.rowCount, 1);
        assert.equal(parseBody.data.rows[0].values['name'], 'USB-C Hub');
    });
    it('should reject parsing when no file has been uploaded (returns 400)', async () => {
        const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                name: 'Empty File Job',
                targetEntity: 'contacts'
            })
        });
        const createBody = await createRes.json();
        const importId = createBody.data.id;
        const parseRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/parse`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({})
        });
        assert.equal(parseRes.status, 400);
        const parseBody = await parseRes.json();
        assert.equal(parseBody.success, false);
        assert.equal(parseBody.error.code, 'VALIDATION_ERROR');
    });
    it('should prevent Tenant B from uploading or parsing Tenant A import (returns 404)', async () => {
        // Tenant A creates an import
        const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-organization-id': 'org_tenant_A',
                'x-user-id': 'user_A'
            },
            body: JSON.stringify({
                name: 'Tenant A Private Import',
                targetEntity: 'contacts'
            })
        });
        const createBody = await createRes.json();
        const importId = createBody.data.id;
        // Tenant B attempts upload
        const uploadRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-organization-id': 'org_tenant_B',
                'x-user-id': 'user_B'
            },
            body: JSON.stringify({
                filename: 'hacked.csv',
                content: 'a,b\n1,2',
                encoding: 'utf-8'
            })
        });
        assert.equal(uploadRes.status, 404);
        // Tenant B attempts parse
        const parseRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/parse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-organization-id': 'org_tenant_B',
                'x-user-id': 'user_B'
            },
            body: JSON.stringify({})
        });
        assert.equal(parseRes.status, 404);
    });
});
//# sourceMappingURL=ingestion-api.test.js.map