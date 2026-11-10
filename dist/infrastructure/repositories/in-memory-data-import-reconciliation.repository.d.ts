/**
 * In-Memory Implementation of Data Import Reconciliation Repository
 */
import { IDataImportReconciliationRepository } from '../../domain/repositories/data-import-reconciliation.repository.interface.js';
import { DataImportReconciliationEntity } from '../../domain/entities/data-import-reconciliation.entity.js';
export declare class InMemoryDataImportReconciliationRepository implements IDataImportReconciliationRepository {
    private reconciliations;
    private getKey;
    create(reconciliation: DataImportReconciliationEntity): Promise<DataImportReconciliationEntity>;
    findById(organizationId: string, id: string): Promise<DataImportReconciliationEntity | null>;
    findByImportId(organizationId: string, importId: string): Promise<DataImportReconciliationEntity | null>;
    findByExecutionId(organizationId: string, executionId: string): Promise<DataImportReconciliationEntity | null>;
    listByImportId(organizationId: string, importId: string): Promise<DataImportReconciliationEntity[]>;
    clear(): Promise<void>;
}
//# sourceMappingURL=in-memory-data-import-reconciliation.repository.d.ts.map