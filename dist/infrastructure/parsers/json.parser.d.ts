/**
 * Safe JSON File Parser
 * Supports JSON array of objects, single objects, and NDJSON/JSONL, with nesting depth limits.
 */
import { ImportFileFormat } from '../../core/types/import.types.js';
import { IImportParser, ParsedDataset, ParseOptions } from '../../core/types/parser.types.js';
export declare class JsonParser implements IImportParser {
    readonly format = ImportFileFormat.JSON;
    private readonly MAX_NESTING_DEPTH;
    canParse(format: ImportFileFormat): boolean;
    /**
     * Flattens nested object up to max depth with dot notation (e.g. { user: { name: 'A' } } -> { 'user.name': 'A' })
     */
    private flattenObject;
    parse(buffer: Buffer, options?: ParseOptions): Promise<ParsedDataset>;
}
//# sourceMappingURL=json.parser.d.ts.map