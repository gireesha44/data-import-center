/**
 * Unit Tests: Column Normalizer & Type Inferencer
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ColumnNormalizer } from '../../../domain/mapping/column-normalizer.js';
import { ImportFileFormat } from '../../../core/types/import.types.js';
import { ParsedDataset } from '../../../core/types/parser.types.js';

describe('ColumnNormalizer', () => {
  it('should normalize various header styles to consistent snake_case format', () => {
    assert.equal(ColumnNormalizer.normalize('First Name'), 'first_name');
    assert.equal(ColumnNormalizer.normalize('firstName'), 'first_name');
    assert.equal(ColumnNormalizer.normalize('first-name'), 'first_name');
    assert.equal(ColumnNormalizer.normalize('FIRST_NAME'), 'first_name');
    assert.equal(ColumnNormalizer.normalize('Customer   Email (Primary)!'), 'customer_email_primary');
    assert.equal(ColumnNormalizer.normalize(''), '');
  });

  it('should extract distinct tokens from header names', () => {
    const tokens = ColumnNormalizer.getTokens('Customer Contact Email');
    assert.deepEqual(tokens, ['customer', 'contact', 'email']);
  });

  it('should calculate Levenshtein distance and similarity ratio accurately', () => {
    assert.equal(ColumnNormalizer.levenshteinDistance('email', 'email'), 0);
    assert.equal(ColumnNormalizer.levenshteinDistance('email', 'e_mail'), 1);

    assert.equal(ColumnNormalizer.similarityRatio('email', 'email'), 1.0);
    assert.ok(ColumnNormalizer.similarityRatio('first_name', 'first_name_alt') > 0.6);
    assert.equal(ColumnNormalizer.similarityRatio('xyz', 'abc'), 0.0);
  });

  it('should infer data types accurately from sample values', () => {
    assert.equal(
      ColumnNormalizer.inferDataType(['jane.doe@example.com', 'admin@corp.io', 'support@test.org']),
      'EMAIL'
    );
    assert.equal(
      ColumnNormalizer.inferDataType(['+1-555-0199', '555-123-4567', '+44 20 7946 0912']),
      'PHONE'
    );
    assert.equal(
      ColumnNormalizer.inferDataType(['true', 'false', 'TRUE', 'no', 'yes']),
      'BOOLEAN'
    );
    assert.equal(
      ColumnNormalizer.inferDataType(['100', '250', 50, '1200']),
      'NUMBER'
    );
    assert.equal(
      ColumnNormalizer.inferDataType(['19.99', '45.50', '9.95', '120.00']),
      'DECIMAL'
    );
    assert.equal(
      ColumnNormalizer.inferDataType(['2026-01-15', '2026-02-28', '2026-03-31']),
      'DATE'
    );
    assert.equal(
      ColumnNormalizer.inferDataType(['Acme Corp', 'Global Logistics', 'Universal Exports']),
      'STRING'
    );
  });

  it('should extract SourceColumns from a ParsedDataset with metrics', () => {
    const dataset: ParsedDataset = {
      format: ImportFileFormat.CSV,
      headers: ['Full Name', 'Email Address', 'Age'],
      normalizedHeaders: [
        { original: 'Full Name', normalized: 'full_name', index: 0, isDuplicate: false, duplicateCount: 1 },
        { original: 'Email Address', normalized: 'email_address', index: 1, isDuplicate: false, duplicateCount: 1 },
        { original: 'Age', normalized: 'age', index: 2, isDuplicate: false, duplicateCount: 1 }
      ],
      duplicateHeaders: [],
      rows: [
        { rowNumber: 1, values: { full_name: 'Alice', email_address: 'alice@example.com', age: 30 } },
        { rowNumber: 2, values: { full_name: 'Bob', email_address: 'bob@example.com', age: 25 } },
        { rowNumber: 3, values: { full_name: 'Charlie', email_address: null, age: 40 } }
      ],
      rowCount: 3,
      columnCount: 3,
      warnings: [],
      statistics: { rowCount: 3, columnCount: 3, emptyRows: 0, malformedRows: 0, totalBytes: 200 },
      metadata: {}
    };

    const sourceCols = ColumnNormalizer.extractSourceColumns(dataset);
    assert.equal(sourceCols.length, 3);
    assert.equal(sourceCols[0].originalName, 'Full Name');
    assert.equal(sourceCols[0].normalizedName, 'full_name');
    assert.equal(sourceCols[1].inferredType, 'EMAIL');
    assert.equal(sourceCols[2].inferredType, 'NUMBER');
    assert.equal(sourceCols[1].emptyPercentage, 33.33);
  });
});
