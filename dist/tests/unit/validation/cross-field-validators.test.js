import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DateRangeCrossFieldValidator } from '../../../domain/validation/cross-field.validators.js';
import { entitySchemaRegistry } from '../../../core/registry/entity-schema.registry.js';
describe('Tier 3 Cross-Field Validators', () => {
    const dateValidator = new DateRangeCrossFieldValidator();
    const invoiceSchema = entitySchemaRegistry.getEntity('invoices');
    const context = {
        organizationId: 'org_1',
        importId: 'imp_1',
        targetEntity: 'invoices',
        rowIndex: 1,
        rawData: {},
        transformedData: {},
        schema: invoiceSchema
    };
    it('passes when due date is on or after issue date', () => {
        const row = {
            issue_date: '2026-05-01',
            due_date: '2026-05-31'
        };
        const issues = dateValidator.validate(row, invoiceSchema, {
            ...context,
            transformedData: row
        });
        assert.equal(issues.length, 0);
    });
    it('flags error when due_date is earlier than issue_date', () => {
        const row = {
            issue_date: '2026-05-31',
            due_date: '2026-05-01'
        };
        const issues = dateValidator.validate(row, invoiceSchema, {
            ...context,
            transformedData: row
        });
        assert.equal(issues.length, 1);
        assert.equal(issues[0].code, 'INVALID_DATE_RANGE');
        assert.equal(issues[0].severity, 'ERROR');
        assert.equal(issues[0].field, 'due_date');
    });
    it('skips validation when dates are not provided', () => {
        const row = {
            issue_date: '2026-05-01'
        };
        const issues = dateValidator.validate(row, invoiceSchema, {
            ...context,
            transformedData: row
        });
        assert.equal(issues.length, 0);
    });
});
//# sourceMappingURL=cross-field-validators.test.js.map