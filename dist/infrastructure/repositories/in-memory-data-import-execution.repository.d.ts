/**
 * In-Memory Data Import Execution Repository Implementation
 */
import { IDataImportExecutionRepository } from '../../domain/repositories/data-import-execution.repository.interface.js';
import { DataImportExecutionEntity } from '../../domain/entities/data-import-execution.entity.js';
export declare class InMemoryDataImportExecutionRepository implements IDataImportExecutionRepository {
    private executions;
    create(entity: DataImportExecutionEntity): Promise<DataImportExecutionEntity>;
    findById(organizationId: string, id: string): Promise<DataImportExecutionEntity | null>;
    findByImportId(organizationId: string, importId: string): Promise<DataImportExecutionEntity | null>;
    listByImportId(organizationId: string, importId: string): Promise<DataImportExecutionEntity[]>;
    update(entity: DataImportExecutionEntity): Promise<DataImportExecutionEntity>;
    clear(): void;
}
export declare const inMemoryDataImportExecutionRepository: InMemoryDataImportExecutionRepository;
//# sourceMappingURL=in-memory-data-import-execution.repository.d.ts.map