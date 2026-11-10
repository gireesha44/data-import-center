/**
 * Unit Tests: JSON Parser
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JsonParser } from '../../../infrastructure/parsers/json.parser.js';
import { ImportFileFormat } from '../../../core/types/import.types.js';
import { ValidationError } from '../../../core/errors/import.errors.js';
describe('JsonParser', () => {
    const parser = new JsonParser();
    it('should parse standard JSON array of objects and extract headers & values', async () => {
        const jsonStr = JSON.stringify([
            { id: 1, name: 'Product A', price: 99.5, inStock: true },
            { id: 2, name: 'Product B', price: 49.0, inStock: false }
        ]);
        const result = await parser.parse(Buffer.from(jsonStr, 'utf-8'));
        assert.equal(result.format, ImportFileFormat.JSON);
        assert.equal(result.rowCount, 2);
        assert.equal(result.columnCount, 4);
        assert.deepEqual(result.headers, ['id', 'name', 'price', 'inStock']);
        assert.equal(result.rows[0].values['name'], 'Product A');
        assert.equal(result.rows[0].values['price'], 99.5);
        assert.equal(result.rows[1].values['in_stock'], false);
    });
    it('should flatten nested objects using dot notation (e.g. customer.address.city)', async () => {
        const nestedJson = JSON.stringify([
            {
                orderId: 'ORD-101',
                customer: {
                    name: 'Alice',
                    address: {
                        city: 'San Francisco',
                        zip: '94105'
                    }
                }
            }
        ]);
        const result = await parser.parse(Buffer.from(nestedJson, 'utf-8'));
        assert.equal(result.rowCount, 1);
        assert.ok(result.headers.includes('customer.address.city'));
        assert.equal(result.rows[0].values['customer.address.city'], 'San Francisco');
        assert.equal(result.rows[0].values['customer.name'], 'Alice');
    });
    it('should parse Newline-Delimited JSON (NDJSON / JSONL)', async () => {
        const ndjson = '{"id": 1, "user": "alice"}\n{"id": 2, "user": "bob"}\n{"id": 3, "user": "charlie"}';
        const result = await parser.parse(Buffer.from(ndjson, 'utf-8'));
        assert.equal(result.rowCount, 3);
        assert.equal(result.rows[0].values['user'], 'alice');
        assert.equal(result.rows[2].values['user'], 'charlie');
    });
    it('should parse root object with nested items array', async () => {
        const wrappedJson = JSON.stringify({
            status: 'success',
            records: [
                { code: 'A1', desc: 'First' },
                { code: 'A2', desc: 'Second' }
            ]
        });
        const result = await parser.parse(Buffer.from(wrappedJson, 'utf-8'));
        assert.equal(result.rowCount, 2);
        assert.equal(result.rows[0].values['code'], 'A1');
        assert.ok(result.warnings.some((w) => w.includes('Auto-extracted records')));
    });
    it('should reject malformed JSON with ValidationError', async () => {
        const badJson = '{ "unclosed": true, ';
        await assert.rejects(async () => parser.parse(Buffer.from(badJson, 'utf-8')), ValidationError);
    });
});
//# sourceMappingURL=json-parser.test.js.map