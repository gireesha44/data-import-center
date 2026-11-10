import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ValidationEngine } from '../../../domain/validation/validation.engine.js';
import { entitySchemaRegistry } from '../../../core/registry/entity-schema.registry.js';
import { RecordStatus } from '../../../core/types/import.types.js';
import { DataImportMappingEntity } from '../../../domain/entities/data-import-mapping.entity.js';

describe('Validation Engine Multi-Tier Orchestration', () => {
  const engine = new ValidationEngine();
  const contactSchema = entitySchemaRegistry.getEntity('contacts')!;
  const invoiceSchema = entitySchemaRegistry.getEntity('invoices')!;
  const contextInfo = { organizationId: 'org_1', importId: 'imp_1' };

  it('validates valid row and marks status VALID', () => {
    const validRow = {
      first_name: 'Alice',
      last_name: 'Smith',
      email: 'alice.smith@example.com',
      status: 'ACTIVE'
    };

    const result = engine.validateRow(1, validRow, validRow, {}, contactSchema, contextInfo);

    assert.equal(result.status, RecordStatus.VALID);
    assert.equal(result.isValid, true);
    assert.equal(result.issues.length, 0);
  });

  it('marks row INVALID if required field missing', () => {
    const invalidRow = {
      first_name: 'Alice',
      // missing last_name and email
      status: 'ACTIVE'
    };

    const result = engine.validateRow(1, invalidRow, invalidRow, {}, contactSchema, contextInfo);

    assert.equal(result.status, RecordStatus.INVALID);
    assert.equal(result.isValid, false);
    assert.ok(result.issues.some((i) => i.field === 'last_name'));
    assert.ok(result.issues.some((i) => i.field === 'email'));
  });

  it('marks row WARNING if only warning-level issues exist', () => {
    const warningRow = {
      invoice_number: 'INV-1001',
      customer_email: 'cust@example.com',
      total_amount: 150000.00, // triggers Tier 4 high value invoice warning
      issue_date: '2026-05-01',
      due_date: '2026-05-30',
      status: 'ISSUED'
    };

    const result = engine.validateRow(1, warningRow, warningRow, {}, invoiceSchema, contextInfo);

    assert.equal(result.status, RecordStatus.WARNING);
    assert.equal(result.isValid, true);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].severity, 'WARNING');
    assert.equal(result.issues[0].code, 'HIGH_VALUE_INVOICE');
  });

  it('validates full dataset and computes accurate summary', () => {
    const rows = [
      { first_name: 'Alice', last_name: 'Smith', email: 'alice@example.com', status: 'ACTIVE' },
      { first_name: 'Bob', last_name: 'Jones', email: 'invalid-email', status: 'ACTIVE' },
      { first_name: 'Carol', last_name: 'Taylor', email: 'carol@example.com', status: 'ACTIVE' }
    ];

    const mapping = new DataImportMappingEntity({
      id: 'map_1',
      organizationId: 'org_1',
      importId: 'imp_1',
      columnMappings: {
        first_name: { sourceColumn: 'first_name', targetField: 'first_name', targetType: 'STRING', required: true },
        last_name: { sourceColumn: 'last_name', targetField: 'last_name', targetType: 'STRING', required: true },
        email: { sourceColumn: 'email', targetField: 'email', targetType: 'EMAIL', required: true },
        status: { sourceColumn: 'status', targetField: 'status', targetType: 'ENUM', required: false }
      }
    });

    const { results, summary } = engine.validateDataset(rows, mapping, contactSchema, contextInfo);

    assert.equal(results.length, 3);
    assert.equal(summary.totalRows, 3);
    assert.equal(summary.validRows, 2);
    assert.equal(summary.invalidRows, 1);
    assert.equal(summary.errorCount, 1);
  });
});
