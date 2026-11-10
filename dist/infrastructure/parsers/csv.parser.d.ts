/**
 * Robust CSV File Parser
 * Supports RFC 4180 parsing, delimiter auto-detection, quoted values, BOM stripping, and duplicate header tracking.
 */
import { ImportFileFormat } from '../../core/types/import.types.js';
import { IImportParser, ParsedDataset, ParseOptions } from '../../core/types/parser.types.js';
export declare class CsvParser implements IImportParser {
    readonly format = ImportFileFormat.CSV;
    canParse(format: ImportFileFormat): boolean;
    /**
     * Auto-detects the delimiter by counting occurrences of candidates outside quoted regions.
     */
    detectDelimiter(textSample: string): string;
    /**
     * RFC 4180 compliant CSV tokenizer parsing full text into array of string arrays.
     */
    tokenize(text: string, delimiter: string): string[][];
    parse(buffer: Buffer, options?: ParseOptions): Promise<ParsedDataset>;
}
//# sourceMappingURL=csv.parser.d.ts.map