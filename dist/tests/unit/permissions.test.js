/**
 * Unit Tests: Permissions & Security Context
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DataImportPermission, hasPermission, hasAllPermissions, hasAnyPermission } from '../../core/types/permissions.types.js';
describe('Permissions & Security Context', () => {
    const mockContext = {
        userId: 'user_123',
        organizationId: 'org_456',
        roles: ['data_operator'],
        permissions: [
            DataImportPermission.DATA_IMPORT_VIEW,
            DataImportPermission.DATA_IMPORT_CREATE,
            DataImportPermission.DATA_IMPORT_VALIDATE
        ]
    };
    it('should correctly evaluate granted permissions', () => {
        assert.equal(hasPermission(mockContext, DataImportPermission.DATA_IMPORT_VIEW), true);
        assert.equal(hasPermission(mockContext, DataImportPermission.DATA_IMPORT_CREATE), true);
        assert.equal(hasPermission(mockContext, DataImportPermission.DATA_IMPORT_VALIDATE), true);
    });
    it('should reject ungranted permissions', () => {
        assert.equal(hasPermission(mockContext, DataImportPermission.DATA_IMPORT_EXECUTE), false);
        assert.equal(hasPermission(mockContext, DataImportPermission.DATA_IMPORT_APPROVE), false);
        assert.equal(hasPermission(mockContext, DataImportPermission.DATA_IMPORT_CANCEL), false);
    });
    it('should handle hasAllPermissions correctly', () => {
        assert.equal(hasAllPermissions(mockContext, [
            DataImportPermission.DATA_IMPORT_VIEW,
            DataImportPermission.DATA_IMPORT_CREATE
        ]), true);
        assert.equal(hasAllPermissions(mockContext, [
            DataImportPermission.DATA_IMPORT_VIEW,
            DataImportPermission.DATA_IMPORT_EXECUTE
        ]), false);
    });
    it('should handle hasAnyPermission correctly', () => {
        assert.equal(hasAnyPermission(mockContext, [
            DataImportPermission.DATA_IMPORT_EXECUTE,
            DataImportPermission.DATA_IMPORT_CREATE
        ]), true);
        assert.equal(hasAnyPermission(mockContext, [
            DataImportPermission.DATA_IMPORT_EXECUTE,
            DataImportPermission.DATA_IMPORT_APPROVE
        ]), false);
    });
    it('should return false safely for undefined context or empty permissions', () => {
        assert.equal(hasPermission(undefined, DataImportPermission.DATA_IMPORT_VIEW), false);
        const emptyCtx = {
            userId: 'u',
            organizationId: 'o',
            roles: [],
            permissions: []
        };
        assert.equal(hasPermission(emptyCtx, DataImportPermission.DATA_IMPORT_VIEW), false);
    });
});
//# sourceMappingURL=permissions.test.js.map