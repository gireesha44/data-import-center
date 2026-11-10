/**
 * Persistent Data Import Mapping Repository Implementation
 */
import { IDataImportMappingRepository } from '../../domain/repositories/data-import-mapping.repository.interface.js';
import { DataImportMappingEntity } from '../../domain/entities/data-import-mapping.entity.js';
export declare class PersistentDataImportMappingRepository implements IDataImportMappingRepository {
    private loadAll;
    private saveAll;
    save(mapping: DataImportMappingEntity): Promise<DataImportMappingEntity>;
    findByImportId(organizationId: string, importId: string): Promise<DataImportMappingEntity | null>;
    deleteByImportId(organizationId: string, importId: string): Promise<boolean>;
    clear(): Promise<void>;
}
//# sourceMappingURL=persistent-data-import-mapping.repository.d.ts.map