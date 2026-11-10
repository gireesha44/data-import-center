/**
 * Unit Tests: Entity Schema Registry
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
describe('EntitySchemaRegistry', () => {
    let registry;
    beforeEach(() => {
        registry = new EntitySchemaRegistry();
    });
    const testSchema = {
        module: 'finance',
        entity: 'invoices',
        displayName: 'Customer Invoices',
        version: 1,
        fields: {
            invoice_number: {
                name: 'invoice_number',
                label: 'Invoice #',
                type: 'STRING',
                required: true,
                unique: true
            },
            amount: {
                name: 'amount',
                label: 'Total Amount',
                type: 'DECIMAL',
                required: true
            },
            customer_email: {
                name: 'customer_email',
                label: 'Customer Email',
                type: 'EMAIL',
                required: false
            }
        },
        duplicateRules: [
            {
                name: 'Unique Invoice Number',
                fields: ['invoice_number'],
                strategy: 'EXACT_MATCH',
                isDefault: true
            }
        ],
        approvalPolicy: {
            requiresApproval: true,
            thresholdRowCount: 1000
        }
    };
    it('should register and retrieve entity schemas by case-insensitive name', () => {
        registry.registerEntity(testSchema);
        assert.equal(registry.hasEntity('invoices'), true);
        assert.equal(registry.hasEntity('INVOICES'), true);
        assert.equal(registry.hasEntity('Invoices'), true);
        const retrieved = registry.getEntity('Invoices');
        assert.ok(retrieved);
        assert.equal(retrieved.displayName, 'Customer Invoices');
        assert.equal(retrieved.module, 'finance');
    });
    it('should list all registered entities', () => {
        registry.registerEntity(testSchema);
        registry.registerEntity({
            module: 'hr',
            entity: 'employees',
            displayName: 'Employees',
            version: 1,
            fields: {},
            duplicateRules: []
        });
        const list = registry.listEntities();
        assert.equal(list.length, 2);
        assert.ok(list.some((e) => e.entity === 'invoices'));
        assert.ok(list.some((e) => e.entity === 'employees'));
    });
    it('should return required fields accurately', () => {
        registry.registerEntity(testSchema);
        const requiredFields = registry.getRequiredFields('invoices');
        assert.equal(requiredFields.length, 2);
        assert.ok(requiredFields.includes('invoice_number'));
        assert.ok(requiredFields.includes('amount'));
        assert.ok(!requiredFields.includes('customer_email'));
    });
    it('should return empty fields for unknown entities', () => {
        assert.equal(registry.hasEntity('nonexistent'), false);
        assert.equal(registry.getEntity('nonexistent'), undefined);
        assert.deepEqual(registry.getEntityFields('nonexistent'), {});
        assert.deepEqual(registry.getRequiredFields('nonexistent'), []);
    });
    it('should throw error when registering schema without entity name', () => {
        assert.throws(() => registry.registerEntity({
            module: 'finance',
            entity: '',
            displayName: 'Invalid',
            version: 1,
            fields: {},
            duplicateRules: []
        }), /Cannot register entity without entity name/);
    });
});
//# sourceMappingURL=entity-registry.test.js.map