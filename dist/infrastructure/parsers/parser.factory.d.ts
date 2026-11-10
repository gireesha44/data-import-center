/**
 * Parser Factory
 * Resolves parser implementations based on file format.
 */
import { ImportFileFormat } from '../../core/types/import.types.js';
import { IImportParser } from '../../core/types/parser.types.js';
export declare class ParserFactory {
    private static parsers;
    static getParser(format: ImportFileFormat): IImportParser;
    static registerParser(format: ImportFileFormat, parser: IImportParser): void;
}
//# sourceMappingURL=parser.factory.d.ts.map