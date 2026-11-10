/**
 * Parser and File Ingestion Domain Types
 */
import { ImportFileFormat } from './import.types.js';
export interface FileMetadata {
    id: string;
    originalName: string;
    detectedFormat: ImportFileFormat;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    encoding: string;
    storagePath: string;
    uploadedAt: Date;
}
export interface ParseOptions {
    delimiter?: string;
    encoding?: string;
    hasHeader?: boolean;
    headerRow?: number;
    sheet?: string;
    previewLimit?: number;
    jsonPath?: string;
    xmlRecordPath?: string;
    maxRows?: number;
    maxColumns?: number;
}
export interface NormalizedHeader {
    original: string;
    normalized: string;
    index: number;
    isDuplicate?: boolean;
    duplicateCount?: number;
}
export interface ParsedRow {
    rowNumber: number;
    values: Record<string, unknown>;
    raw?: unknown[] | Record<string, unknown>;
}
export interface ParseStatistics {
    rowCount: number;
    columnCount: number;
    emptyRows: number;
    malformedRows: number;
    totalBytes: number;
}
export interface ParsedDataset {
    format: ImportFileFormat;
    headers: string[];
    normalizedHeaders: NormalizedHeader[];
    duplicateHeaders: string[];
    rows: ParsedRow[];
    rowCount: number;
    columnCount: number;
    warnings: string[];
    statistics: ParseStatistics;
    metadata: Record<string, unknown>;
}
export interface IImportParser {
    readonly format: ImportFileFormat;
    canParse(format: ImportFileFormat): boolean;
    parse(buffer: Buffer, options?: ParseOptions): Promise<ParsedDataset>;
}
//# sourceMappingURL=parser.types.d.ts.map