/**
 * Safe Excel File Parser (.xlsx, .xls)
 * Reads spreadsheets without macro execution or formula evaluation, supports multi-sheet discovery and sheet selection.
 */
import { ImportFileFormat } from '../../core/types/import.types.js';
import { IImportParser, ParsedDataset, ParseOptions } from '../../core/types/parser.types.js';
export declare class ExcelParser implements IImportParser {
    readonly format = ImportFileFormat.XLSX;
    canParse(format: ImportFileFormat): boolean;
    parse(buffer: Buffer, options?: ParseOptions): Promise<ParsedDataset>;
}
//# sourceMappingURL=excel.parser.d.ts.map