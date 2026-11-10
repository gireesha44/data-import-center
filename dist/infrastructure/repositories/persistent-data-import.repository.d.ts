/**
 * Persistent Data Import Repository Implementation
 * Backed by durable disk storage with multi-tenant isolation, queries, filtering, sorting, and pagination.
 */
import { IDataImportRepository } from '../../domain/repositories/data-import.repository.interface.js';
import { DataImportEntity } from '../../domain/entities/data-import.entity.js';
import { ImportFilterQuery, PaginatedResult } from '../../core/types/import.types.js';
export declare class PersistentDataImportRepository implements IDataImportRepository {
    private loadAll;
    private saveAll;
    create(entity: DataImportEntity): Promise<DataImportEntity>;
    findById(organizationId: string, id: string): Promise<DataImportEntity | null>;
    findMany(organizationId: string, query: ImportFilterQuery): Promise<PaginatedResult<DataImportEntity>>;
    update(entity: DataImportEntity): Promise<DataImportEntity>;
    delete(organizationId: string, id: string): Promise<boolean>;
    count(organizationId: string, query?: Partial<ImportFilterQuery>): Promise<number>;
    clear(): Promise<void>;
}
//# sourceMappingURL=persistent-data-import.repository.d.ts.map