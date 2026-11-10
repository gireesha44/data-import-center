/**
 * Robust CSV File Parser
 * Supports RFC 4180 parsing, delimiter auto-detection, quoted values, BOM stripping, and duplicate header tracking.
 */
import { ImportFileFormat } from '../../core/types/import.types.js';
import { ValidationError } from '../../core/errors/import.errors.js';
export class CsvParser {
    format = ImportFileFormat.CSV;
    canParse(format) {
        return format === ImportFileFormat.CSV;
    }
    /**
     * Auto-detects the delimiter by counting occurrences of candidates outside quoted regions.
     */
    detectDelimiter(textSample) {
        const candidates = [',', ';', '\t', '|'];
        const lines = textSample.split(/\r?\n/).slice(0, 10).filter((l) => l.trim().length > 0);
        if (lines.length === 0)
            return ',';
        const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
        for (const line of lines) {
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                }
                else if (!inQuotes && candidates.includes(char)) {
                    counts[char]++;
                }
            }
        }
        let bestDelimiter = ',';
        let maxCount = -1;
        for (const [delim, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                bestDelimiter = delim;
            }
        }
        return maxCount > 0 ? bestDelimiter : ',';
    }
    /**
     * RFC 4180 compliant CSV tokenizer parsing full text into array of string arrays.
     */
    tokenize(text, delimiter) {
        const rows = [];
        let currentRow = [];
        let currentCell = '';
        let inQuotes = false;
        let i = 0;
        const len = text.length;
        while (i < len) {
            const char = text[i];
            const nextChar = i + 1 < len ? text[i + 1] : '';
            if (inQuotes) {
                if (char === '"') {
                    if (nextChar === '"') {
                        // Escaped quote ("")
                        currentCell += '"';
                        i += 2;
                        continue;
                    }
                    else {
                        // End of quoted cell
                        inQuotes = false;
                        i++;
                        continue;
                    }
                }
                else {
                    currentCell += char;
                    i++;
                    continue;
                }
            }
            else {
                if (char === '"') {
                    inQuotes = true;
                    i++;
                    continue;
                }
                else if (char === delimiter) {
                    currentRow.push(currentCell.trim());
                    currentCell = '';
                    i++;
                    continue;
                }
                else if (char === '\r') {
                    if (nextChar === '\n') {
                        i++;
                    }
                    currentRow.push(currentCell.trim());
                    rows.push(currentRow);
                    currentRow = [];
                    currentCell = '';
                    i++;
                    continue;
                }
                else if (char === '\n') {
                    currentRow.push(currentCell.trim());
                    rows.push(currentRow);
                    currentRow = [];
                    currentCell = '';
                    i++;
                    continue;
                }
                else {
                    currentCell += char;
                    i++;
                    continue;
                }
            }
        }
        // Push trailing cell & row if non-empty
        if (currentCell.length > 0 || currentRow.length > 0) {
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
        }
        return rows;
    }
    async parse(buffer, options = {}) {
        if (!buffer || buffer.length === 0) {
            throw new ValidationError('Cannot parse empty CSV buffer');
        }
        // 1. Strip UTF-8 BOM if present
        let rawText = buffer.toString('utf-8');
        if (rawText.charCodeAt(0) === 0xFEFF) {
            rawText = rawText.slice(1);
        }
        const warnings = [];
        // 2. Determine Delimiter
        const delimiter = options.delimiter || this.detectDelimiter(rawText.slice(0, 4096));
        // 3. Tokenize CSV
        const rawGrid = this.tokenize(rawText, delimiter);
        // Filter out completely empty rows
        const nonEmptyGrid = rawGrid.filter((row) => row.some((c) => c.length > 0));
        if (nonEmptyGrid.length === 0) {
            return {
                format: ImportFileFormat.CSV,
                headers: [],
                normalizedHeaders: [],
                duplicateHeaders: [],
                rows: [],
                rowCount: 0,
                columnCount: 0,
                warnings: ['File contains only whitespace or empty rows'],
                statistics: {
                    rowCount: 0,
                    columnCount: 0,
                    emptyRows: rawGrid.length,
                    malformedRows: 0,
                    totalBytes: buffer.length
                },
                metadata: {
                    delimiter,
                    hasHeader: true
                }
            };
        }
        // 4. Header Processing
        const headerRowIndex = options.headerRow !== undefined ? options.headerRow : 0;
        const rawHeaderRow = nonEmptyGrid[headerRowIndex] || [];
        const dataRows = nonEmptyGrid.slice(headerRowIndex + 1);
        const headers = [];
        const normalizedHeaders = [];
        const duplicateHeaders = [];
        const headerCountMap = {};
        for (let colIdx = 0; colIdx < rawHeaderRow.length; colIdx++) {
            let rawHeader = rawHeaderRow[colIdx]?.trim();
            if (!rawHeader || rawHeader.length === 0) {
                rawHeader = `column_${colIdx + 1}`;
                warnings.push(`Empty header at column ${colIdx + 1} was assigned name '${rawHeader}'`);
            }
            headers.push(rawHeader);
            const normalizedKey = rawHeader.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            headerCountMap[normalizedKey] = (headerCountMap[normalizedKey] || 0) + 1;
            let finalNormalized = normalizedKey;
            let isDuplicate = false;
            const count = headerCountMap[normalizedKey];
            if (count > 1) {
                isDuplicate = true;
                finalNormalized = `${normalizedKey}_${count - 1}`;
                if (!duplicateHeaders.includes(rawHeader)) {
                    duplicateHeaders.push(rawHeader);
                }
                warnings.push(`Duplicate header '${rawHeader}' at column ${colIdx + 1} was disambiguated to '${finalNormalized}'`);
            }
            normalizedHeaders.push({
                original: rawHeader,
                normalized: finalNormalized,
                index: colIdx,
                isDuplicate,
                duplicateCount: count
            });
        }
        // 5. Build Parsed Rows
        const previewLimit = options.previewLimit !== undefined ? options.previewLimit : dataRows.length;
        const maxRows = options.maxRows || dataRows.length;
        const rowSlice = dataRows.slice(0, Math.min(previewLimit, maxRows));
        let malformedCount = 0;
        const rows = [];
        for (let r = 0; r < rowSlice.length; r++) {
            const rowData = rowSlice[r];
            const rowValues = {};
            if (rowData.length !== rawHeaderRow.length) {
                malformedCount++;
            }
            for (let c = 0; c < normalizedHeaders.length; c++) {
                const headerInfo = normalizedHeaders[c];
                const val = r < dataRows.length && c < rowData.length ? rowData[c] : null;
                rowValues[headerInfo.normalized] = val !== '' ? val : null;
            }
            rows.push({
                rowNumber: r + 1,
                values: rowValues,
                raw: rowData
            });
        }
        return {
            format: ImportFileFormat.CSV,
            headers,
            normalizedHeaders,
            duplicateHeaders,
            rows,
            rowCount: dataRows.length,
            columnCount: normalizedHeaders.length,
            warnings,
            statistics: {
                rowCount: dataRows.length,
                columnCount: normalizedHeaders.length,
                emptyRows: rawGrid.length - nonEmptyGrid.length,
                malformedRows: malformedCount,
                totalBytes: buffer.length
            },
            metadata: {
                delimiter,
                detectedEncoding: 'utf-8',
                headerRowIndex
            }
        };
    }
}
//# sourceMappingURL=csv.parser.js.map