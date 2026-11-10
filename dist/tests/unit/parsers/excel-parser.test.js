/**
 * Unit Tests: Excel Parser (.xlsx, .xls)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { ExcelParser } from '../../../infrastructure/parsers/excel.parser.js';
import { ImportFileFormat } from '../../../core/types/import.types.js';
describe('ExcelParser', () => {
    const parser = new ExcelParser();
    // Helper to generate in-memory Excel buffer
    const createWorkbookBuffer = (sheetsData) => {
        const wb = XLSX.utils.book_new();
        for (const [sheetName, data] of Object.entries(sheetsData)) {
            const ws = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    };
    it('should parse single-sheet Excel workbook with headers and data rows', async () => {
        const buffer = createWorkbookBuffer({
            Customers: [
                ['Customer Name', 'Email', 'Credit Limit'],
                ['Acme Corp', 'contact@acme.com', 50000],
                ['Global Tech', 'info@global.com', 120000]
            ]
        });
        const result = await parser.parse(buffer);
        assert.equal(result.format, ImportFileFormat.XLSX);
        assert.equal(result.rowCount, 2);
        assert.equal(result.columnCount, 3);
        assert.deepEqual(result.headers, ['Customer Name', 'Email', 'Credit Limit']);
        assert.equal(result.rows[0].values['customer_name'], 'Acme Corp');
        assert.equal(result.rows[0].values['credit_limit'], 50000);
    });
    it('should discover multiple sheets and allow specific sheet selection', async () => {
        const buffer = createWorkbookBuffer({
            Summary: [['Metric', 'Value'], ['Total', 100]],
            Details: [['ID', 'Item', 'Qty'], [1, 'Widget A', 10], [2, 'Widget B', 25]]
        });
        // 1. Default (first sheet)
        const resultSummary = await parser.parse(buffer);
        assert.equal(resultSummary.metadata['selectedSheet'], 'Summary');
        assert.deepEqual(resultSummary.metadata['sheetNames'], ['Summary', 'Details']);
        assert.equal(resultSummary.rowCount, 1);
        // 2. Select 'Details' sheet explicitly
        const resultDetails = await parser.parse(buffer, { sheet: 'Details' });
        assert.equal(resultDetails.metadata['selectedSheet'], 'Details');
        assert.equal(resultDetails.rowCount, 2);
        assert.equal(resultDetails.rows[0].values['item'], 'Widget A');
    });
    it('should handle empty worksheets gracefully', async () => {
        const buffer = createWorkbookBuffer({
            EmptySheet: []
        });
        const result = await parser.parse(buffer);
        assert.equal(result.rowCount, 0);
        assert.equal(result.rows.length, 0);
        assert.ok(result.warnings.some((w) => w.includes('empty')));
    });
    it('should read formula cells as computed values without evaluating scripts', async () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['Product', 'Price', 'Qty', 'Total'],
            ['Laptop', 1000, 2, { f: 'B2*C2', v: 2000 }]
        ]);
        XLSX.utils.book_append_sheet(wb, ws, 'Sales');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const result = await parser.parse(buffer);
        assert.equal(result.rowCount, 1);
        assert.equal(Number(result.rows[0].values['total']), 2000);
    });
});
//# sourceMappingURL=excel-parser.test.js.map