/**
 * Unit Tests: XML Parser
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { XmlParser } from '../../../infrastructure/parsers/xml.parser.js';
import { ImportFileFormat } from '../../../core/types/import.types.js';
import { SecurityViolationError, ValidationError } from '../../../core/errors/import.errors.js';

describe('XmlParser', () => {
  const parser = new XmlParser();

  it('should parse standard XML document with repeating record elements', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="bk101">
    <author>Gambardella, Matthew</author>
    <title>XML Developer's Guide</title>
    <price>44.95</price>
  </book>
  <book id="bk102">
    <author>Ralls, Kim</author>
    <title>Midnight Rain</title>
    <price>5.95</price>
  </book>
</catalog>`;

    const result = await parser.parse(Buffer.from(xml, 'utf-8'));

    assert.equal(result.format, ImportFileFormat.XML);
    assert.equal(result.rowCount, 2);
    assert.ok(result.headers.includes('author'));
    assert.ok(result.headers.includes('title'));
    assert.ok(result.headers.includes('price'));
    assert.equal(result.rows[0].values['author'], 'Gambardella, Matthew');
    assert.equal(result.rows[0].values['price'], 44.95);
    assert.equal(result.rows[1].values['title'], 'Midnight Rain');
  });

  it('should block XML external entity (XXE) and DOCTYPE injection attempts', async () => {
    const xxeXml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE foo [  
  <!ELEMENT foo ANY >
  <!ENTITY xxe SYSTEM "file:///etc/passwd" >]>
<foo>&xxe;</foo>`;

    await assert.rejects(
      async () => parser.parse(Buffer.from(xxeXml, 'utf-8')),
      SecurityViolationError
    );
  });

  it('should reject malformed XML with ValidationError', async () => {
    const malformed = '<root><unclosed>Tag</root>';
    await assert.rejects(
      async () => parser.parse(Buffer.from(malformed, 'utf-8')),
      ValidationError
    );
  });
});
