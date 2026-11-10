/**
 * In-Memory Staged Data Import Record Repository Implementation
 */
import { IDataImportRecordRepository, RecordFilterOptions } from '../../domain/repositories/data-import-record.repository.interface.js';
import { DataImportRecordEntity } from '../../domain/entities/data-import-record.entity.js';
import { PaginatedResult } from '../../core/types/import.types.js';
export declare class InMemoryDataImportRecordRepository implements IDataImportRecordRepository {
    private recordsByImport;
    saveBatch(records: DataImportRecordEntity[]): Promise<void>;
    findByImportId(organizationId: string, importId: string, options?: RecordFilterOptions): Promise<PaginatedResult<DataImportRecordEntity>>;
    findById(organizationId: string, id: string): Promise<DataImportRecordEntity | null>;
    countByStatus(organizationId: string, importId: string): Promise<Record<string, number>>;
    deleteByImportId(organizationId: string, importId: string): Promise<void>;
    clear(): void;
}
//# sourceMappingURL=in-memory-data-import-record.repository.d.ts.map