/**
 * Parser Factory
 * Resolves parser implementations based on file format.
 */

import { ImportFileFormat } from '../../core/types/import.types.js';
import { IImportParser } from '../../core/types/parser.types.js';
import { CsvParser } from './csv.parser.js';
import { ExcelParser } from './excel.parser.js';
import { JsonParser } from './json.parser.js';
import { XmlParser } from './xml.parser.js';
import { ValidationError } from '../../core/errors/import.errors.js';

export class ParserFactory {
  private static parsers: Map<ImportFileFormat, IImportParser> = new Map();

  static {
    const csv = new CsvParser();
    const excel = new ExcelParser();
    const json = new JsonParser();
    const xml = new XmlParser();

    this.parsers.set(ImportFileFormat.CSV, csv);
    this.parsers.set(ImportFileFormat.XLSX, excel);
    this.parsers.set(ImportFileFormat.XLS, excel);
    this.parsers.set(ImportFileFormat.JSON, json);
    this.parsers.set(ImportFileFormat.XML, xml);
  }

  public static getParser(format: ImportFileFormat): IImportParser {
    const parser = this.parsers.get(format);
    if (!parser) {
      throw new ValidationError(`No parser registered for file format '${format}'`);
    }
    return parser;
  }

  public static registerParser(format: ImportFileFormat, parser: IImportParser): void {
    this.parsers.set(format, parser);
  }
}
