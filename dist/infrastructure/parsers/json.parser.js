/**
 * Safe JSON File Parser
 * Supports JSON array of objects, single objects, and NDJSON/JSONL, with nesting depth limits.
 */
import { ImportFileFormat } from '../../core/types/import.types.js';
import { ValidationError } from '../../core/errors/import.errors.js';
export class JsonParser {
    format = ImportFileFormat.JSON;
    MAX_NESTING_DEPTH = 5;
    canParse(format) {
        return format === ImportFileFormat.JSON;
    }
    /**
     * Flattens nested object up to max depth with dot notation (e.g. { user: { name: 'A' } } -> { 'user.name': 'A' })
     */
    flattenObject(obj, depth = 0, prefix = '') {
        if (depth > this.MAX_NESTING_DEPTH) {
            throw new ValidationError(`JSON nesting depth exceeded maximum permitted limit of ${this.MAX_NESTING_DEPTH}`);
        }
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                const nested = this.flattenObject(value, depth + 1, fullKey);
                Object.assign(result, nested);
            }
            else {
                result[fullKey] = value;
            }
        }
        return result;
    }
    async parse(buffer, options = {}) {
        if (!buffer || buffer.length === 0) {
            throw new ValidationError('Cannot parse empty JSON buffer');
        }
        let text = buffer.toString('utf-8').trim();
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.slice(1).trim();
        }
        let rawRecords = [];
        const warnings = [];
        let isParsed = false;
        try {
            const parsedJson = JSON.parse(text);
            isParsed = true;
            if (Array.isArray(parsedJson)) {
                rawRecords = parsedJson.filter((item) => typeof item === 'object' && item !== null);
            }
            else if (typeof parsedJson === 'object' && parsedJson !== null) {
                const objectKeys = Object.keys(parsedJson);
                const arrayKey = objectKeys.find((k) => Array.isArray(parsedJson[k]));
                if (arrayKey) {
                    rawRecords = parsedJson[arrayKey];
                    warnings.push(`Auto-extracted records from root property '${arrayKey}'`);
                }
                else {
                    rawRecords = [parsedJson];
                }
            }
            else {
                throw new ValidationError('JSON root element must be an array of objects or a single object');
            }
        }
        catch {
            // Not a single JSON array or object, attempt NDJSON
        }
        if (!isParsed) {
            const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
            if (lines.length > 0) {
                try {
                    rawRecords = lines.map((line) => JSON.parse(line));
                }
                catch {
                    throw new ValidationError('Failed to parse JSON file: syntax error or malformed JSON payload');
                }
            }
            else {
                throw new ValidationError('Failed to parse JSON file: empty or invalid content');
            }
        }
        if (rawRecords.length === 0) {
            return {
                format: ImportFileFormat.JSON,
                headers: [],
                normalizedHeaders: [],
                duplicateHeaders: [],
                rows: [],
                rowCount: 0,
                columnCount: 0,
                warnings: ['JSON contains zero records'],
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
        // Flatten all records and collect all unique keys as headers
        const flattenedRecords = [];
        const headerSet = new Set();
        for (const raw of rawRecords) {
            const flat = this.flattenObject(raw);
            flattenedRecords.push(flat);
            for (const k of Object.keys(flat)) {
                headerSet.add(k);
            }
        }
        const headers = Array.from(headerSet);
        const normalizedHeaders = [];
        for (let i = 0; i < headers.length; i++) {
            const original = headers[i];
            const normalized = original
                .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
                .toLowerCase()
                .replace(/[^a-z0-9_.]/g, '_');
            normalizedHeaders.push({
                original,
                normalized,
                index: i,
                isDuplicate: false,
                duplicateCount: 1
            });
        }
        const previewLimit = options.previewLimit !== undefined ? options.previewLimit : flattenedRecords.length;
        const maxRows = options.maxRows || flattenedRecords.length;
        const slice = flattenedRecords.slice(0, Math.min(previewLimit, maxRows));
        const rows = [];
        for (let r = 0; r < slice.length; r++) {
            const record = slice[r];
            const rowValues = {};
            for (const h of normalizedHeaders) {
                const val = record[h.original];
                rowValues[h.normalized] = val !== undefined ? val : null;
            }
            rows.push({
                rowNumber: r + 1,
                values: rowValues,
                raw: record
            });
        }
        return {
            format: ImportFileFormat.JSON,
            headers,
            normalizedHeaders,
            duplicateHeaders: [],
            rows,
            rowCount: flattenedRecords.length,
            columnCount: normalizedHeaders.length,
            warnings,
            statistics: {
                rowCount: flattenedRecords.length,
                columnCount: normalizedHeaders.length,
                emptyRows: 0,
                malformedRows: 0,
                totalBytes: buffer.length
            },
            metadata: {
                detectedEncoding: 'utf-8',
                totalRawObjects: rawRecords.length
            }
        };
    }
}
//# sourceMappingURL=json.parser.js.map