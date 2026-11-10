/**
 * In-Memory Data Import Repository Implementation
 * Provides robust multi-tenant queries, filtering, sorting, and pagination.
 */
import { IDataImportRepository } from '../../domain/repositories/data-import.repository.interface.js';
import { DataImportEntity } from '../../domain/entities/data-import.entity.js';
import { ImportFilterQuery, PaginatedResult } from '../../core/types/import.types.js';
export declare class InMemoryDataImportRepository implements IDataImportRepository {
    private imports;
    create(entity: DataImportEntity): Promise<DataImportEntity>;
    findById(organizationId: string, id: string): Promise<DataImportEntity | null>;
    findMany(organizationId: string, query: ImportFilterQuery): Promise<PaginatedResult<DataImportEntity>>;
    update(entity: DataImportEntity): Promise<DataImportEntity>;
    delete(organizationId: string, id: string): Promise<boolean>;
    count(organizationId: string, query?: Partial<ImportFilterQuery>): Promise<number>;
    clear(): void;
}
//# sourceMappingURL=in-memory-data-import.repository.d.ts.map