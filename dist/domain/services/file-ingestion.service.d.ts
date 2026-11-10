/**
 * File Ingestion and Parsing Service
 * Coordinates upload security checks, storage persistence, parser dispatch, and state machine updates.
 */
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportMappingRepository } from '../repositories/data-import-mapping.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { IAuditService } from './audit.service.interface.js';
import { IFileStorageService } from '../../infrastructure/storage/file-storage.service.js';
import { SecurityContext } from '../../core/types/permissions.types.js';
import { FileMetadata, ParseOptions, ParsedDataset } from '../../core/types/parser.types.js';
export declare class FileIngestionService {
    private readonly repository;
    private readonly audit;
    private readonly storage;
    private readonly mappingRepository?;
    private readonly recordRepository?;
    constructor(repository: IDataImportRepository, audit: IAuditService, storage?: IFileStorageService, mappingRepository?: IDataImportMappingRepository | undefined, recordRepository?: IDataImportRecordRepository | undefined);
    /**
     * Uploads and secures an import file, updates import metadata and state machine.
     */
    uploadFile(context: SecurityContext, importId: string, originalFilename: string, content: Buffer, declaredMime?: string): Promise<FileMetadata>;
    /**
     * Parses the stored file for an import job and produces a normalized preview dataset.
     */
    parseFile(context: SecurityContext, importId: string, options?: ParseOptions): Promise<ParsedDataset>;
}
//# sourceMappingURL=file-ingestion.service.d.ts.map