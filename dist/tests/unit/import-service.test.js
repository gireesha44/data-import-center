/**
 * Unit Tests: ImportService
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ImportService } from '../../domain/services/import.service.js';
import { InMemoryDataImportRepository } from '../../infrastructure/repositories/in-memory-data-import.repository.js';
import { AuditService } from '../../infrastructure/services/audit.service.js';
import { EntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { DataImportPermission } from '../../core/types/permissions.types.js';
import { ImportStatus } from '../../core/types/import.types.js';
import { ForbiddenError, NotFoundError, ValidationError, ConflictError, InvalidStateTransitionError } from '../../core/errors/import.errors.js';
describe('ImportService', () => {
    let repository;
    let audit;
    let schemaRegistry;
    let service;
    const validContext = {
        userId: 'user_101',
        organizationId: 'org_acme',
        roles: ['admin'],
        permissions: [
            DataImportPermission.DATA_IMPORT_VIEW,
            DataImportPermission.DATA_IMPORT_CREATE,
            DataImportPermission.DATA_IMPORT_CANCEL
        ]
    };
    beforeEach(() => {
        repository = new InMemoryDataImportRepository();
        audit = new AuditService();
        schemaRegistry = new EntitySchemaRegistry();
        schemaRegistry.registerEntity({
            module: 'crm',
            entity: 'contacts',
            displayName: 'Contacts',
            version: 1,
            fields: {
                id: { name: 'id', label: 'ID', type: 'STRING', required: false }
            },
            duplicateRules: []
        });
        service = new ImportService(repository, audit, schemaRegistry);
    });
    it('should create an import in DRAFT state and record an audit log', async () => {
        const created = await service.createImport(validContext, {
            name: 'Import Contacts Batch 1',
            targetModule: 'crm',
            targetEntity: 'contacts'
        });
        assert.ok(created.id);
        assert.equal(created.name, 'Import Contacts Batch 1');
        assert.equal(created.status, ImportStatus.DRAFT);
        assert.equal(created.organizationId, 'org_acme');
        assert.equal(created.createdBy, 'user_101');
        const auditTrail = await audit.getImportAuditTrail('org_acme', created.id);
        assert.equal(auditTrail.length, 1);
        assert.equal(auditTrail[0].action, 'IMPORT_CREATED');
    });
    it('should reject creation when target entity is not registered in SchemaRegistry', async () => {
        await assert.rejects(async () => service.createImport(validContext, {
            name: 'Unknown Entity Import',
            targetModule: 'unknown',
            targetEntity: 'non_existent_entity'
        }), ValidationError);
    });
    it('should reject creation when missing DATA_IMPORT_CREATE permission', async () => {
        const unprivilegedContext = {
            userId: 'user_guest',
            organizationId: 'org_acme',
            roles: ['guest'],
            permissions: [DataImportPermission.DATA_IMPORT_VIEW]
        };
        await assert.rejects(async () => service.createImport(unprivilegedContext, {
            name: 'Unauthorized Import',
            targetModule: 'crm',
            targetEntity: 'contacts'
        }), ForbiddenError);
    });
    it('should retrieve existing import and reject non-existent import with NotFoundError', async () => {
        const created = await service.createImport(validContext, {
            name: 'Existing Import',
            targetModule: 'crm',
            targetEntity: 'contacts'
        });
        const retrieved = await service.getImport(validContext, created.id);
        assert.equal(retrieved.id, created.id);
        await assert.rejects(async () => service.getImport(validContext, 'invalid_id_999'), NotFoundError);
    });
    it('should update draft import fields and record audit log', async () => {
        const created = await service.createImport(validContext, {
            name: 'Initial Name',
            targetModule: 'crm',
            targetEntity: 'contacts'
        });
        const updated = await service.updateImport(validContext, created.id, {
            name: 'Updated Name'
        });
        assert.equal(updated.name, 'Updated Name');
        assert.equal(updated.version, 2);
        const auditTrail = await audit.getImportAuditTrail('org_acme', created.id);
        assert.equal(auditTrail.length, 2);
        assert.equal(auditTrail[1].action, 'IMPORT_UPDATED');
    });
    it('should persist a resumable draft step and record the draft save', async () => {
        const created = await service.createImport(validContext, {
            name: 'Resumable Import',
            targetModule: 'crm',
            targetEntity: 'contacts'
        });
        created.status = ImportStatus.MAPPED;
        await repository.update(created);
        const saved = await service.saveDraft(validContext, created.id, 3);
        assert.equal(saved.status, ImportStatus.DRAFT);
        assert.equal(saved.importOptions.customOptions?.savedWizardStep, 3);
        assert.ok(saved.importOptions.customOptions?.savedAsDraftAt);
        const auditTrail = await audit.getImportAuditTrail('org_acme', created.id);
        assert.equal(auditTrail.at(-1)?.action, 'IMPORT_SAVED_AS_DRAFT');
        assert.equal(auditTrail.at(-1)?.fromState, ImportStatus.MAPPED);
    });
    it('should reject updating non-editable import (e.g. COMPLETED state)', async () => {
        const created = await service.createImport(validContext, {
            name: 'Terminal Import',
            targetModule: 'crm',
            targetEntity: 'contacts'
        });
        // Manually force to completed
        created.status = ImportStatus.COMPLETED;
        await repository.update(created);
        await assert.rejects(async () => service.updateImport(validContext, created.id, {
            name: 'Should Fail'
        }), ConflictError);
    });
    it('should cancel active import and transition to CANCELLED state via state machine', async () => {
        const created = await service.createImport(validContext, {
            name: 'To Be Cancelled',
            targetModule: 'crm',
            targetEntity: 'contacts'
        });
        const cancelled = await service.cancelImport(validContext, created.id, 'User requested abort');
        assert.equal(cancelled.status, ImportStatus.CANCELLED);
        assert.ok(cancelled.cancelledAt instanceof Date);
        const auditTrail = await audit.getImportAuditTrail('org_acme', created.id);
        assert.ok(auditTrail.some((log) => log.action === 'IMPORT_CANCELLED'));
    });
    it('should reject cancelling an already completed or cancelled import', async () => {
        const created = await service.createImport(validContext, {
            name: 'Terminal Cancel Test',
            targetModule: 'crm',
            targetEntity: 'contacts'
        });
        await service.cancelImport(validContext, created.id, 'First cancel');
        // Attempting to cancel an already cancelled import must throw InvalidStateTransitionError
        await assert.rejects(async () => service.cancelImport(validContext, created.id, 'Second cancel'), InvalidStateTransitionError);
    });
});
//# sourceMappingURL=import-service.test.js.map