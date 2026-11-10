/**
 * Unit Tests: Entity Schema Registry
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EntitySchemaRegistry } from '../../../core/registry/entity-schema.registry.js';
import { ValidationError } from '../../../core/errors/import.errors.js';
describe('EntitySchemaRegistry', () => {
    let registry;
    beforeEach(() => {
        registry = new EntitySchemaRegistry();
    });
    it('should register a valid entity schema and retrieve it', () => {
        const schema = {
            module: 'crm',
            entity: 'leads',
            displayName: 'Sales Leads',
            version: 1,
            fields: {
                company_name: {
                    name: 'company_name',
                    label: 'Company Name',
                    type: 'STRING',
                    required: true
                },
                lead_score: {
                    name: 'lead_score',
                    label: 'Lead Score',
                    type: 'NUMBER',
                    required: false
                }
            },
            duplicateRules: []
        };
        registry.registerEntity(schema);
        assert.equal(registry.hasEntity('leads'), true);
        assert.equal(registry.hasEntity('LEADS'), true); // case-insensitive
        const retrieved = registry.getEntity('leads');
        assert.ok(retrieved);
        assert.equal(retrieved.displayName, 'Sales Leads');
        assert.equal(Object.keys(retrieved.fields).length, 2);
    });
    it('should fail fast when registering entity without entity name or module', () => {
        assert.throws(() => registry.registerEntity({
            module: '',
            entity: 'bad_entity',
            displayName: 'Bad',
            version: 1,
            fields: { x: { name: 'x', label: 'X', type: 'STRING', required: true } },
            duplicateRules: []
        }), ValidationError);
        assert.throws(() => registry.registerEntity({
            module: 'crm',
            entity: '',
            displayName: 'Bad',
            version: 1,
            fields: { x: { name: 'x', label: 'X', type: 'STRING', required: true } },
            duplicateRules: []
        }), ValidationError);
    });
    it('should reject schema with missing field properties', () => {
        assert.throws(() => registry.registerEntity({
            module: 'crm',
            entity: 'missing_label',
            displayName: 'Missing Label',
            version: 1,
            fields: {
                f1: { name: 'f1', label: '', type: 'STRING', required: true }
            },
            duplicateRules: []
        }), ValidationError);
    });
    it('should reject schema with duplicate field names (case-insensitive)', () => {
        assert.throws(() => registry.registerEntity({
            module: 'crm',
            entity: 'duplicate_fields',
            displayName: 'Dup',
            version: 1,
            fields: {
                email: { name: 'email', label: 'Email', type: 'EMAIL', required: true },
                Email: { name: 'Email', label: 'Duplicate Email', type: 'EMAIL', required: true }
            },
            duplicateRules: []
        }), ValidationError);
    });
    it('should reject ENUM field without enumValues defined', () => {
        assert.throws(() => registry.registerEntity({
            module: 'crm',
            entity: 'bad_enum',
            displayName: 'Bad Enum',
            version: 1,
            fields: {
                status: { name: 'status', label: 'Status', type: 'ENUM', required: true }
            },
            duplicateRules: []
        }), ValidationError);
    });
    it('should retrieve required fields excluding read-only fields', () => {
        registry.registerEntity({
            module: 'crm',
            entity: 'deals',
            displayName: 'Deals',
            version: 1,
            fields: {
                id: { name: 'id', label: 'ID', type: 'IDENTIFIER', required: true, readOnly: true },
                title: { name: 'title', label: 'Deal Title', type: 'STRING', required: true },
                amount: { name: 'amount', label: 'Deal Amount', type: 'DECIMAL', required: true },
                notes: { name: 'notes', label: 'Notes', type: 'STRING', required: false }
            },
            duplicateRules: []
        });
        const requiredFields = registry.getRequiredFields('deals');
        assert.deepEqual(requiredFields.sort(), ['amount', 'title'].sort());
    });
    it('should list all importable entities', () => {
        registry.registerEntity({
            module: 'crm',
            entity: 'e1',
            displayName: 'E1',
            version: 1,
            fields: { f1: { name: 'f1', label: 'F1', type: 'STRING', required: true } },
            duplicateRules: []
        });
        registry.registerEntity({
            module: 'crm',
            entity: 'e2',
            displayName: 'E2',
            version: 1,
            isImportable: false,
            fields: { f2: { name: 'f2', label: 'F2', type: 'STRING', required: true } },
            duplicateRules: []
        });
        const list = registry.listEntities();
        assert.equal(list.length, 1);
        assert.equal(list[0].entity, 'e1');
    });
});
//# sourceMappingURL=entity-schema-registry.test.js.map