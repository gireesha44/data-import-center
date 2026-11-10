/**
 * Safe XML File Parser
 * Uses fast-xml-parser with XMLValidator, XXE, DTD expansion, and external resource loading explicitly disabled.
 */

import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { ImportFileFormat } from '../../core/types/import.types.js';
import {
  IImportParser,
  ParsedDataset,
  ParsedRow,
  NormalizedHeader,
  ParseOptions
} from '../../core/types/parser.types.js';
import { ValidationError, SecurityViolationError } from '../../core/errors/import.errors.js';

export class XmlParser implements IImportParser {
  public readonly format = ImportFileFormat.XML;

  public canParse(format: ImportFileFormat): boolean {
    return format === ImportFileFormat.XML;
  }

  public async parse(buffer: Buffer, options: ParseOptions = {}): Promise<ParsedDataset> {
    if (!buffer || buffer.length === 0) {
      throw new ValidationError('Cannot parse empty XML buffer');
    }

    let text = buffer.toString('utf-8').trim();
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1).trim();
    }

    // XXE and DTD guard
    const upper = text.toUpperCase();
    if (
      upper.includes('<!DOCTYPE') &&
      (upper.includes('SYSTEM') || upper.includes('PUBLIC') || upper.includes('<!ENTITY'))
    ) {
      throw new SecurityViolationError(
        'XML external entity (XXE) and DTD entity definitions are blocked for security.',
        [{ code: 'XML_EXTERNAL_ENTITY_BLOCKED', message: 'DOCTYPE/ENTITY declarations are not permitted' }]
      );
    }

    // Strict XML Syntax Validation
    const validationStatus = XMLValidator.validate(text);
    if (validationStatus !== true) {
      const msg =
        typeof validationStatus === 'object' && validationStatus.err
          ? validationStatus.err.msg
          : 'syntax error or malformed XML document';
      throw new ValidationError(`Failed to parse XML file: ${msg}`);
    }

    const xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      parseTagValue: true,
      trimValues: true,
      processEntities: false,
      stopNodes: []
    });

    let parsedDoc: Record<string, unknown>;
    try {
      parsedDoc = xmlParser.parse(text);
    } catch (err) {
      throw new ValidationError('Failed to parse XML file: syntax error or malformed XML document');
    }

    if (!parsedDoc || typeof parsedDoc !== 'object') {
      throw new ValidationError('XML document root is empty or invalid');
    }

    // Locate repeating record array or single record in XML document
    let rawRecords: Record<string, unknown>[] = [];
    const warnings: string[] = [];

    const findRecords = (node: unknown): Record<string, unknown>[] => {
      if (!node || typeof node !== 'object') return [];

      if (Array.isArray(node)) {
        return node.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
      }

      const recordObj = node as Record<string, unknown>;
      // Filter out XML declaration/directive keys (e.g. ?xml, #text, comments)
      const cleanKeys = Object.keys(recordObj).filter((k) => !k.startsWith('?') && !k.startsWith('#'));

      // 1. Direct array of objects
      for (const key of cleanKeys) {
        const val = recordObj[key];
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          return val as Record<string, unknown>[];
        }
      }

      // 2. Recursive search in child objects
      for (const key of cleanKeys) {
        const val = recordObj[key];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const nested = findRecords(val);
          if (nested.length > 0) {
            return nested;
          }
        }
      }

      // 3. Single child element
      if (cleanKeys.length === 1) {
        const singleChild = recordObj[cleanKeys[0]];
        if (singleChild && typeof singleChild === 'object' && !Array.isArray(singleChild)) {
          return [singleChild as Record<string, unknown>];
        }
      }

      return [recordObj];
    };

    rawRecords = findRecords(parsedDoc);

    if (rawRecords.length === 0) {
      return {
        format: ImportFileFormat.XML,
        headers: [],
        normalizedHeaders: [],
        duplicateHeaders: [],
        rows: [],
        rowCount: 0,
        columnCount: 0,
        warnings: ['XML document does not contain repeating record elements'],
        statistics: {
          rowCount: 0,
          columnCount: 0,
          emptyRows: 0,
          malformedRows: 0,
          totalBytes: buffer.length
        },
        metadata: {
          structure: 'empty'
        }
      };
    }

    // Extract headers
    const headerSet = new Set<string>();
    for (const record of rawRecords) {
      for (const key of Object.keys(record)) {
        headerSet.add(key);
      }
    }

    const headers = Array.from(headerSet);
    const normalizedHeaders: NormalizedHeader[] = [];

    for (let i = 0; i < headers.length; i++) {
      const original = headers[i];
      const normalized = original.replace(/^@_/, '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
      normalizedHeaders.push({
        original,
        normalized,
        index: i,
        isDuplicate: false,
        duplicateCount: 1
      });
    }

    const previewLimit = options.previewLimit !== undefined ? options.previewLimit : rawRecords.length;
    const maxRows = options.maxRows || rawRecords.length;
    const slice = rawRecords.slice(0, Math.min(previewLimit, maxRows));

    const rows: ParsedRow[] = [];
    for (let r = 0; r < slice.length; r++) {
      const record = slice[r];
      const rowValues: Record<string, unknown> = {};

      for (const h of normalizedHeaders) {
        const val = record[h.original];
        if (typeof val === 'object' && val !== null) {
          rowValues[h.normalized] = JSON.stringify(val);
        } else {
          rowValues[h.normalized] = val !== undefined ? val : null;
        }
      }

      rows.push({
        rowNumber: r + 1,
        values: rowValues,
        raw: record
      });
    }

    return {
      format: ImportFileFormat.XML,
      headers,
      normalizedHeaders,
      duplicateHeaders: [],
      rows,
      rowCount: rawRecords.length,
      columnCount: normalizedHeaders.length,
      warnings,
      statistics: {
        rowCount: rawRecords.length,
        columnCount: normalizedHeaders.length,
        emptyRows: 0,
        malformedRows: 0,
        totalBytes: buffer.length
      },
      metadata: {
        detectedEncoding: 'utf-8',
        totalRawElements: rawRecords.length
      }
    };
  }
}
