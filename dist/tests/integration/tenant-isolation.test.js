/**
 * Integration Tests: Multi-Tenant Isolation
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../app.js';
import { InMemoryDataImportRepository } from '../../infrastructure/repositories/in-memory-data-import.repository.js';
describe('Multi-Tenant Isolation (Integration)', () => {
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
    it('should prevent Tenant B from reading an import created by Tenant A (returns 404)', async () => {
        // 1. Tenant A creates an import
        const resA = await fetch(`${baseUrl}/api/v1/data-imports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-organization-id': 'org_alpha',
                'x-user-id': 'user_alice'
            },
            body: JSON.stringify({
                name: 'Tenant Alpha Secret Import',
                targetEntity: 'contacts'
            })
        });
        const bodyA = await resA.json();
        const importId = bodyA.data.id;
        // 2. Tenant B attempts to read Tenant A's import
        const resB = await fetch(`${baseUrl}/api/v1/data-imports/${importId}`, {
            headers: {
                'x-organization-id': 'org_beta',
                'x-user-id': 'user_bob'
            }
        });
        assert.equal(resB.status, 404);
        const bodyB = await resB.json();
        assert.equal(bodyB.success, false);
        assert.equal(bodyB.error.code, 'NOT_FOUND');
    });
    it('should prevent Tenant B from updating an import belonging to Tenant A', async () => {
        // 1. Tenant A creates an import
        const resA = await fetch(`${baseUrl}/api/v1/data-imports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-organization-id': 'org_alpha',
                'x-user-id': 'user_alice'
            },
            body: JSON.stringify({
                name: 'Tenant Alpha Modifiable Import',
                targetEntity: 'contacts'
            })
        });
        const bodyA = await resA.json();
        const importId = bodyA.data.id;
        // 2. Tenant B attempts to PATCH Tenant A's import
        const patchRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-organization-id': 'org_beta',
                'x-user-id': 'user_bob'
            },
            body: JSON.stringify({
                name: 'Hacked by Tenant Beta'
            })
        });
        assert.equal(patchRes.status, 404);
    });
    it('should prevent Tenant B from cancelling an import belonging to Tenant A', async () => {
        // 1. Tenant A creates an import
        const resA = await fetch(`${baseUrl}/api/v1/data-imports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-organization-id': 'org_alpha',
                'x-user-id': 'user_alice'
            },
            body: JSON.stringify({
                name: 'Tenant Alpha Active Import',
                targetEntity: 'contacts'
            })
        });
        const bodyA = await resA.json();
        const importId = bodyA.data.id;
        // 2. Tenant B attempts to CANCEL Tenant A's import
        const cancelRes = await fetch(`${baseUrl}/api/v1/data-imports/${importId}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-organization-id': 'org_beta',
                'x-user-id': 'user_bob'
            },
            body: JSON.stringify({
                reason: 'Malicious abort attempt'
            })
        });
        assert.equal(cancelRes.status, 404);
    });
    it('should strictly isolate list results between tenants', async () => {
        // Alpha list should only see org_alpha items
        const resAlpha = await fetch(`${baseUrl}/api/v1/data-imports`, {
            headers: {
                'x-organization-id': 'org_alpha',
                'x-user-id': 'user_alice'
            }
        });
        const bodyAlpha = await resAlpha.json();
        for (const item of bodyAlpha.data) {
            assert.equal(item.organizationId, 'org_alpha');
        }
        // Beta list should only see org_beta items
        const resBeta = await fetch(`${baseUrl}/api/v1/data-imports`, {
            headers: {
                'x-organization-id': 'org_beta',
                'x-user-id': 'user_bob'
            }
        });
        const bodyBeta = await resBeta.json();
        for (const item of bodyBeta.data) {
            assert.equal(item.organizationId, 'org_beta');
        }
    });
});
//# sourceMappingURL=tenant-isolation.test.js.map