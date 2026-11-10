/**
 * Cleaned Data Export Domain Service
 *
 * Multi-format export generator (CSV, XLSX, PDF, DOCX) for cleaned datasets,
 * rejected records, and comprehensive import summaries.
 */
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { IEntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { SecurityContext } from '../../core/types/permissions.types.js';
import { IFileStorageService } from '../../infrastructure/storage/file-storage.service.js';
export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'docx';
export type ExportScope = 'cleaned' | 'rejected' | 'all';
export interface CleanedExportOptions {
    format: ExportFormat;
    scope?: ExportScope;
    columns?: string[];
    includeSummary?: boolean;
}
export interface ExportResult {
    contentType: string;
    filename: string;
    buffer: Buffer;
    recordCount: number;
    excludedDuplicatesCount: number;
    excludedInvalidCount: number;
}
export declare class CleanedDataExportService {
    private readonly importRepository;
    private readonly recordRepository;
    private readonly schemaRegistry;
    private readonly storage?;
    constructor(importRepository: IDataImportRepository, recordRepository: IDataImportRecordRepository, schemaRegistry: IEntitySchemaRegistry, storage?: IFileStorageService | undefined);
    exportDataset(context: SecurityContext, importId: string, options: CleanedExportOptions): Promise<ExportResult>;
    private generateCsv;
    private generateXlsx;
    private generatePdfReport;
    private generateDocxReport;
}
//# sourceMappingURL=cleaned-export.service.d.ts.map