/**
 * Safe Excel File Parser (.xlsx, .xls)
 * Reads spreadsheets without macro execution or formula evaluation, supports multi-sheet discovery and sheet selection.
 */
import * as XLSX from 'xlsx';
import { ImportFileFormat } from '../../core/types/import.types.js';
import { ValidationError } from '../../core/errors/import.errors.js';
export class ExcelParser {
    format = ImportFileFormat.XLSX;
    canParse(format) {
        return format === ImportFileFormat.XLSX || format === ImportFileFormat.XLS;
    }
    async parse(buffer, options = {}) {
        if (!buffer || buffer.length === 0) {
            throw new ValidationError('Cannot parse empty Excel workbook buffer');
        }
        let workbook;
        try {
            workbook = XLSX.read(buffer, {
                type: 'buffer',
                cellFormula: false,
                cellHTML: false,
                raw: true,
                dense: false
            });
        }
        catch (err) {
            throw new ValidationError('Failed to parse Excel workbook: file is corrupted or not a valid spreadsheet');
        }
        const sheetNames = workbook.SheetNames || [];
        if (sheetNames.length === 0) {
            throw new ValidationError('Excel workbook does not contain any worksheets');
        }
        const selectedSheetName = options.sheet || sheetNames[0];
        const worksheet = workbook.Sheets[selectedSheetName];
        if (!worksheet) {
            throw new ValidationError(`Worksheet '${selectedSheetName}' was not found in workbook. Available sheets: ${sheetNames.join(', ')}`);
        }
        // Convert sheet to array of row arrays
        const rawGrid = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: null,
            blankrows: false,
            raw: true
        });
        const warnings = [];
        if (sheetNames.length > 1 && !options.sheet) {
            warnings.push(`Workbook has ${sheetNames.length} sheets (${sheetNames.join(', ')}). Defaulting to '${selectedSheetName}'.`);
        }
        if (rawGrid.length === 0) {
            return {
                format: ImportFileFormat.XLSX,
                headers: [],
                normalizedHeaders: [],
                duplicateHeaders: [],
                rows: [],
                rowCount: 0,
                columnCount: 0,
                warnings: [`Worksheet '${selectedSheetName}' is empty`],
                statistics: {
                    rowCount: 0,
                    columnCount: 0,
                    emptyRows: 0,
                    malformedRows: 0,
                    totalBytes: buffer.length
                },
                metadata: {
                    sheetNames,
                    selectedSheet: selectedSheetName
                }
            };
        }
        // Header Processing
        const headerRowIndex = options.headerRow !== undefined ? options.headerRow : 0;
        const rawHeaderRow = (rawGrid[headerRowIndex] || []);
        const dataRows = rawGrid.slice(headerRowIndex + 1);
        const headers = [];
        const normalizedHeaders = [];
        const duplicateHeaders = [];
        const headerCountMap = {};
        for (let colIdx = 0; colIdx < rawHeaderRow.length; colIdx++) {
            let rawHeader = String(rawHeaderRow[colIdx] ?? '').trim();
            if (!rawHeader) {
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
        const previewLimit = options.previewLimit !== undefined ? options.previewLimit : dataRows.length;
        const maxRows = options.maxRows || dataRows.length;
        const rowSlice = dataRows.slice(0, Math.min(previewLimit, maxRows));
        const rows = [];
        for (let r = 0; r < rowSlice.length; r++) {
            const rowData = rowSlice[r] || [];
            const rowValues = {};
            for (let c = 0; c < normalizedHeaders.length; c++) {
                const headerInfo = normalizedHeaders[c];
                const val = c < rowData.length ? rowData[c] : null;
                rowValues[headerInfo.normalized] = val !== '' && val !== undefined ? val : null;
            }
            rows.push({
                rowNumber: r + 1,
                values: rowValues,
                raw: rowData
            });
        }
        return {
            format: ImportFileFormat.XLSX,
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
                emptyRows: 0,
                malformedRows: 0,
                totalBytes: buffer.length
            },
            metadata: {
                sheetNames,
                selectedSheet: selectedSheetName,
                totalSheets: sheetNames.length,
                headerRowIndex
            }
        };
    }
}
//# sourceMappingURL=excel.parser.js.map