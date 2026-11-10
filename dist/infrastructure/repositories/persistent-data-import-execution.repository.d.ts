/**
 * Persistent Data Import Execution Repository Implementation
 */
import { IDataImportExecutionRepository } from '../../domain/repositories/data-import-execution.repository.interface.js';
import { DataImportExecutionEntity } from '../../domain/entities/data-import-execution.entity.js';
export declare class PersistentDataImportExecutionRepository implements IDataImportExecutionRepository {
    private loadAll;
    private saveAll;
    create(entity: DataImportExecutionEntity): Promise<DataImportExecutionEntity>;
    findById(organizationId: string, id: string): Promise<DataImportExecutionEntity | null>;
    findByImportId(organizationId: string, importId: string): Promise<DataImportExecutionEntity | null>;
    listByImportId(organizationId: string, importId: string): Promise<DataImportExecutionEntity[]>;
    update(entity: DataImportExecutionEntity): Promise<DataImportExecutionEntity>;
    clear(): Promise<void>;
}
//# sourceMappingURL=persistent-data-import-execution.repository.d.ts.map