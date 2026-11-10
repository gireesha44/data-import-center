/**
 * Unit Tests: CSV Parser
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CsvParser } from '../../../infrastructure/parsers/csv.parser.js';
import { ImportFileFormat } from '../../../core/types/import.types.js';

describe('CsvParser', () => {
  const parser = new CsvParser();

  it('should parse standard comma-separated CSV with headers and rows', async () => {
    const csvContent = 'first_name,last_name,email,age\nAlice,Smith,alice@example.com,30\nBob,Jones,bob@example.com,25';
    const buffer = Buffer.from(csvContent, 'utf-8');

    const result = await parser.parse(buffer);

    assert.equal(result.format, ImportFileFormat.CSV);
    assert.equal(result.rowCount, 2);
    assert.equal(result.columnCount, 4);
    assert.deepEqual(result.headers, ['first_name', 'last_name', 'email', 'age']);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].values['first_name'], 'Alice');
    assert.equal(result.rows[0].values['email'], 'alice@example.com');
    assert.equal(result.rows[1].values['first_name'], 'Bob');
  });

  it('should auto-detect semicolon (;) and tab (\t) delimiters correctly', async () => {
    const semicolonCsv = 'id;name;department\n1;Engineering;Dev\n2;Finance;Acc';
    const resSemi = await parser.parse(Buffer.from(semicolonCsv, 'utf-8'));
    assert.equal(resSemi.metadata['delimiter'], ';');
    assert.equal(resSemi.rowCount, 2);
    assert.equal(resSemi.rows[0].values['name'], 'Engineering');

    const tabTsv = 'sku\tprice\tqty\nSKU-001\t99.99\t10\nSKU-002\t19.99\t50';
    const resTab = await parser.parse(Buffer.from(tabTsv, 'utf-8'));
    assert.equal(resTab.metadata['delimiter'], '\t');
    assert.equal(resTab.rowCount, 2);
    assert.equal(resTab.rows[0].values['sku'], 'SKU-001');
  });

  it('should handle quoted values containing commas, escaped quotes (""), and newlines', async () => {
    const complexCsv = 'id,description,notes\n1,"Item, with comma","Note with ""escaped"" quotes"\n2,"Multi\nline\nvalue",Normal';
    const result = await parser.parse(Buffer.from(complexCsv, 'utf-8'));

    assert.equal(result.rowCount, 2);
    assert.equal(result.rows[0].values['description'], 'Item, with comma');
    assert.equal(result.rows[0].values['notes'], 'Note with "escaped" quotes');
    assert.equal(result.rows[1].values['description'], 'Multi\nline\nvalue');
    assert.equal(result.rows[1].values['notes'], 'Normal');
  });

  it('should strip UTF-8 BOM automatically', async () => {
    const bomCsv = '\uFEFFname,status\nActive User,ACTIVE';
    const result = await parser.parse(Buffer.from(bomCsv, 'utf-8'));

    assert.equal(result.headers[0], 'name');
    assert.equal(result.rows[0].values['name'], 'Active User');
  });

  it('should disambiguate duplicate headers and track original vs normalized names', async () => {
    const dupCsv = 'name,email,name,phone,name\nJohn,j@ex.com,Johnny,123,J';
    const result = await parser.parse(Buffer.from(dupCsv, 'utf-8'));

    assert.equal(result.headers.length, 5);
    assert.ok(result.duplicateHeaders.includes('name'));
    assert.equal(result.normalizedHeaders[0].normalized, 'name');
    assert.equal(result.normalizedHeaders[2].normalized, 'name_1');
    assert.equal(result.normalizedHeaders[4].normalized, 'name_2');

    assert.equal(result.rows[0].values['name'], 'John');
    assert.equal(result.rows[0].values['name_1'], 'Johnny');
    assert.equal(result.rows[0].values['name_2'], 'J');
    assert.ok(result.warnings.some((w) => w.includes('Duplicate header')));
  });

  it('should assign fallback names to empty header columns', async () => {
    const emptyHeaderCsv = 'first_name,,last_name\nJohn,Secret,Doe';
    const result = await parser.parse(Buffer.from(emptyHeaderCsv, 'utf-8'));

    assert.equal(result.headers[1], 'column_2');
    assert.equal(result.rows[0].values['column_2'], 'Secret');
  });

  it('should respect previewLimit option', async () => {
    const longCsv = 'id,val\n1,a\n2,b\n3,c\n4,d\n5,e';
    const result = await parser.parse(Buffer.from(longCsv, 'utf-8'), { previewLimit: 2 });

    assert.equal(result.rowCount, 5); // Total rows in file
    assert.equal(result.rows.length, 2); // Previewed rows
  });
});
