/**
 * Persistent Staged Data Import Record Repository Implementation
 * Backed by durable disk storage with full filter, search, duplicate, status, and pagination logic.
 */
import { IDataImportRecordRepository, RecordFilterOptions } from '../../domain/repositories/data-import-record.repository.interface.js';
import { DataImportRecordEntity } from '../../domain/entities/data-import-record.entity.js';
import { PaginatedResult } from '../../core/types/import.types.js';
export declare class PersistentDataImportRecordRepository implements IDataImportRecordRepository {
    private loadAll;
    private saveAll;
    saveBatch(records: DataImportRecordEntity[]): Promise<void>;
    findByImportId(organizationId: string, importId: string, options?: RecordFilterOptions): Promise<PaginatedResult<DataImportRecordEntity>>;
    findById(organizationId: string, id: string): Promise<DataImportRecordEntity | null>;
    countByStatus(organizationId: string, importId: string): Promise<Record<string, number>>;
    deleteByImportId(organizationId: string, importId: string): Promise<void>;
    clear(): Promise<void>;
}
//# sourceMappingURL=persistent-data-import-record.repository.d.ts.map