import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EntitySchemaRegistry } from '../../../core/registry/entity-schema.registry.js';
import { ValidationEngine } from '../../../domain/validation/validation.engine.js';
import { DataImportMappingEntity } from '../../../domain/entities/data-import-mapping.entity.js';
describe('Invoice Schema Transformation & Validation Suite', () => {
    let registry;
    let engine;
    let invoiceMapping;
    beforeEach(() => {
        registry = new EntitySchemaRegistry();
        engine = new ValidationEngine();
        registry.registerEntity({
            module: 'finance',
            entity: 'invoices',
            displayName: 'Invoices',
            version: 1,
            fields: {
                invoice_number: {
                    name: 'invoice_number',
                    label: 'Invoice Number',
                    type: 'STRING',
                    required: true,
                    unique: true
                },
                customer_email: {
                    name: 'customer_email',
                    label: 'Customer Email',
                    type: 'EMAIL',
                    required: true
                },
                total_amount: {
                    name: 'total_amount',
                    label: 'Total Amount',
                    type: 'DECIMAL',
                    required: true
                },
                issue_date: {
                    name: 'issue_date',
                    label: 'Issue Date',
                    type: 'DATE',
                    required: true
                },
                due_date: {
                    name: 'due_date',
                    label: 'Due Date',
                    type: 'DATE',
                    required: false
                },
                currency: {
                    name: 'currency',
                    label: 'Currency',
                    type: 'STRING',
                    required: false,
                    defaultValue: 'USD'
                },
                status: {
                    name: 'status',
                    label: 'Status',
                    type: 'ENUM',
                    required: false,
                    enumValues: ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED'],
                    defaultValue: 'ISSUED'
                }
            },
            duplicateRules: [
                {
                    name: 'Invoice Number Match',
                    fields: ['invoice_number'],
                    strategy: 'EXACT_MATCH'
                }
            ]
        });
        invoiceMapping = new DataImportMappingEntity({
            id: 'map-inv-1',
            organizationId: 'org-test',
            importId: 'imp-inv-1',
            columnMappings: {
                invoice_number: { sourceColumn: 'invoice_number', targetField: 'invoice_number', targetType: 'STRING', required: true },
                customer_email: { sourceColumn: 'customer_email', targetField: 'customer_email', targetType: 'EMAIL', required: true },
                total_amount: { sourceColumn: 'total_amount', targetField: 'total_amount', targetType: 'DECIMAL', required: true },
                issue_date: { sourceColumn: 'issue_date', targetField: 'issue_date', targetType: 'DATE', required: true },
                due_date: { sourceColumn: 'due_date', targetField: 'due_date', targetType: 'DATE', required: false },
                currency: { sourceColumn: 'currency', targetField: 'currency', targetType: 'STRING', required: false },
                status: { sourceColumn: 'status', targetField: 'status', targetType: 'ENUM', required: false }
            }
        });
    });
    it('should validate clean invoice dataset with 3 valid rows and 0 invalid rows', () => {
        const invoiceSchema = registry.getEntity('invoices');
        const cleanRows = [
            {
                invoice_number: 'INV-1001',
                customer_email: 'customer1@example.com',
                total_amount: '1250',
                issue_date: '2026-09-01',
                due_date: '2026-09-30',
                currency: 'USD',
                status: 'ISSUED'
            },
            {
                invoice_number: 'INV-1002',
                customer_email: 'customer2@example.com',
                total_amount: '2750.50',
                issue_date: '2026-09-05',
                due_date: '2026-10-05',
                currency: 'USD',
                status: 'PAID'
            },
            {
                invoice_number: 'INV-1003',
                customer_email: 'customer3@example.com',
                total_amount: '890.75',
                issue_date: '2026-09-10',
                due_date: '2026-10-10',
                currency: 'EUR',
                status: 'OVERDUE'
            }
        ];
        const { summary, results } = engine.validateDataset(cleanRows, invoiceMapping, invoiceSchema, { organizationId: 'org-test', importId: 'imp-inv-1' });
        assert.equal(summary.totalRows, 3);
        assert.equal(summary.validRows, 3);
        assert.equal(summary.invalidRows, 0);
        assert.equal(results.every((r) => r.status === 'VALID'), true);
    });
    it('should perform safe whitespace & case normalization on " Paid " -> "PAID"', () => {
        const invoiceSchema = registry.getEntity('invoices');
        const dirtyRow = {
            invoice_number: 'INV-1001',
            customer_email: 'customer1@example.com',
            total_amount: ' 1,250.50 ',
            issue_date: '2026-09-01',
            due_date: '2026-09-30',
            currency: 'USD',
            status: ' Paid '
        };
        const transformResult = engine['pipeline'].transformRow(1, dirtyRow, invoiceMapping, invoiceSchema, { organizationId: 'org-test', importId: 'imp-inv-1' });
        assert.equal(transformResult.transformedData.status, 'PAID');
        assert.equal(transformResult.transformedData.total_amount, 1250.5);
        const validationResult = engine.validateRow(1, dirtyRow, transformResult.transformedData, transformResult.transformationErrors, invoiceSchema, { organizationId: 'org-test', importId: 'imp-inv-1' });
        assert.equal(validationResult.status, 'VALID');
    });
    it('should flag "Pending" status as INVALID enum value and NOT invent "ISSUED"', () => {
        const invoiceSchema = registry.getEntity('invoices');
        const unapprovedRow = {
            invoice_number: 'INV-1002',
            customer_email: 'customer2@example.com',
            total_amount: '2750.50',
            issue_date: '2026-09-05',
            due_date: '2026-10-05',
            currency: 'USD',
            status: 'Pending'
        };
        const transformResult = engine['pipeline'].transformRow(2, unapprovedRow, invoiceMapping, invoiceSchema, { organizationId: 'org-test', importId: 'imp-inv-1' });
        // Normalize enum leaves unapproved value untouched
        assert.equal(transformResult.transformedData.status, 'Pending');
        const validationResult = engine.validateRow(2, unapprovedRow, transformResult.transformedData, transformResult.transformationErrors, invoiceSchema, { organizationId: 'org-test', importId: 'imp-inv-1' });
        assert.equal(validationResult.status, 'INVALID');
        assert.equal(validationResult.issues.some((i) => i.code === 'INVALID_ENUM_VALUE'), true);
    });
});
//# sourceMappingURL=invoice-transformation-validation.test.js.map