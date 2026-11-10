/**
 * Unit Tests: File Security & MIME Validator
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FileSecurityValidator } from '../../../infrastructure/security/file-security-validator.js';
import { ImportConfigService } from '../../../core/config/import.config.js';
import { ImportFileFormat } from '../../../core/types/import.types.js';
import { SecurityViolationError, ValidationError } from '../../../core/errors/import.errors.js';

describe('FileSecurityValidator', () => {
  beforeEach(() => {
    ImportConfigService.reset();
  });

  it('should detect valid CSV content and format', () => {
    const csvBuffer = Buffer.from('id,name,email\n1,Alice,alice@example.com', 'utf-8');
    const result = FileSecurityValidator.validate('contacts.csv', csvBuffer);

    assert.equal(result.isValid, true);
    assert.equal(result.detectedFormat, ImportFileFormat.CSV);
    assert.equal(result.mimeType, 'text/csv');
  });

  it('should detect JSON array content and format', () => {
    const jsonBuffer = Buffer.from('[{"name":"test"}]', 'utf-8');
    const result = FileSecurityValidator.validate('data.json', jsonBuffer);

    assert.equal(result.isValid, true);
    assert.equal(result.detectedFormat, ImportFileFormat.JSON);
  });

  it('should detect XML content and format', () => {
    const xmlBuffer = Buffer.from('<?xml version="1.0"?><root><item>1</item></root>', 'utf-8');
    const result = FileSecurityValidator.validate('feed.xml', xmlBuffer);

    assert.equal(result.isValid, true);
    assert.equal(result.detectedFormat, ImportFileFormat.XML);
  });

  it('should reject executable binaries claiming to be CSV (MIME spoofing defense)', () => {
    // Windows MZ header disguised as CSV
    const exeBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    assert.throws(
      () => FileSecurityValidator.validate('malicious.csv', exeBuffer),
      SecurityViolationError
    );

    // Linux ELF header disguised as CSV
    const elfBuffer = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00]);
    assert.throws(
      () => FileSecurityValidator.validate('payload.csv', elfBuffer),
      SecurityViolationError
    );
  });

  it('should reject files exceeding max configured size', () => {
    ImportConfigService.update({ maxFileSizeBytes: 100 }); // 100 bytes max
    const oversizedBuffer = Buffer.alloc(500, 'a');

    assert.throws(
      () => FileSecurityValidator.validate('big.csv', oversizedBuffer),
      ValidationError
    );
  });

  it('should reject empty 0-byte uploads', () => {
    assert.throws(
      () => FileSecurityValidator.validate('empty.csv', Buffer.alloc(0)),
      ValidationError
    );
  });

  it('should reject XXE attack payloads in XML', () => {
    const xxeBuffer = Buffer.from(
      '<!DOCTYPE doc [<!ENTITY win SYSTEM "file:///c:/boot.ini">]><doc>&win;</doc>',
      'utf-8'
    );

    assert.throws(
      () => FileSecurityValidator.validate('test.xml', xxeBuffer),
      SecurityViolationError
    );
  });
});
