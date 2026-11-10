/**
 * Integration Tests: Audit Trail Recording
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../app.js';
import { auditService } from '../../infrastructure/services/audit.service.js';
import { ImportStatus } from '../../core/types/import.types.js';
describe('Audit Trail Recording (Integration)', () => {
    let server;
    let baseUrl;
    before(async () => {
        auditService.clear();
        const app = createApp({ auditService });
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
    it('should record immutable audit entries for creation, updating, and cancelling an import', async () => {
        const orgId = 'org_audit_test';
        const userId = 'user_auditor';
        const headers = {
            'Content-Type': 'application/json',
            'x-organization-id': orgId,
            'x-user-id': userId
        };
        // 1. Create Import
        const createRes = await fetch(`${baseUrl}/api/v1/data-imports`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: 'Audit Ingestion Job',
                targetEntity: 'contacts'
            })
        });
        const createBody = await createRes.json();
        const importId = createBody.data.id;
        // 2. Update Import
        await fetch(`${baseUrl}/api/v1/data-imports/${importId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                name: 'Audit Ingestion Job - Renamed'
            })
        });
        // 3. Cancel Import
        await fetch(`${baseUrl}/api/v1/data-imports/${importId}/cancel`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                reason: 'Cancelled for audit verification'
            })
        });
        // 4. Query Audit Trail
        const logs = await auditService.getImportAuditTrail(orgId, importId);
        assert.equal(logs.length, 3);
        // Event 1: Creation
        assert.equal(logs[0].action, 'IMPORT_CREATED');
        assert.equal(logs[0].actorUserId, userId);
        assert.equal(logs[0].toState, ImportStatus.DRAFT);
        // Event 2: Update
        assert.equal(logs[1].action, 'IMPORT_UPDATED');
        assert.equal(logs[1].actorUserId, userId);
        // Event 3: Cancellation
        assert.equal(logs[2].action, 'IMPORT_CANCELLED');
        assert.equal(logs[2].fromState, ImportStatus.DRAFT);
        assert.equal(logs[2].toState, ImportStatus.CANCELLED);
        assert.equal(logs[2].details.reason, 'Cancelled for audit verification');
    });
});
//# sourceMappingURL=audit-trail.test.js.map