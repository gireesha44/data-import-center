/**
 * Safe XML File Parser
 * Uses fast-xml-parser with XMLValidator, XXE, DTD expansion, and external resource loading explicitly disabled.
 */
import { ImportFileFormat } from '../../core/types/import.types.js';
import { IImportParser, ParsedDataset, ParseOptions } from '../../core/types/parser.types.js';
export declare class XmlParser implements IImportParser {
    readonly format = ImportFileFormat.XML;
    canParse(format: ImportFileFormat): boolean;
    parse(buffer: Buffer, options?: ParseOptions): Promise<ParsedDataset>;
}
//# sourceMappingURL=xml.parser.d.ts.map