/**
 * In-Memory Data Import Mapping Repository Implementation
 */
import { IDataImportMappingRepository } from '../../domain/repositories/data-import-mapping.repository.interface.js';
import { DataImportMappingEntity } from '../../domain/entities/data-import-mapping.entity.js';
export declare class InMemoryDataImportMappingRepository implements IDataImportMappingRepository {
    private mappingsByImportId;
    save(mapping: DataImportMappingEntity): Promise<DataImportMappingEntity>;
    findByImportId(organizationId: string, importId: string): Promise<DataImportMappingEntity | null>;
    deleteByImportId(organizationId: string, importId: string): Promise<boolean>;
    clear(): void;
}
//# sourceMappingURL=in-memory-data-import-mapping.repository.d.ts.map