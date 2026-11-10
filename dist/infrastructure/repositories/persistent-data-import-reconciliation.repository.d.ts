/**
 * Persistent Data Import Reconciliation Repository Implementation
 */
import { IDataImportReconciliationRepository } from '../../domain/repositories/data-import-reconciliation.repository.interface.js';
import { DataImportReconciliationEntity } from '../../domain/entities/data-import-reconciliation.entity.js';
export declare class PersistentDataImportReconciliationRepository implements IDataImportReconciliationRepository {
    private loadAll;
    private saveAll;
    create(reconciliation: DataImportReconciliationEntity): Promise<DataImportReconciliationEntity>;
    findById(organizationId: string, id: string): Promise<DataImportReconciliationEntity | null>;
    findByImportId(organizationId: string, importId: string): Promise<DataImportReconciliationEntity | null>;
    findByExecutionId(organizationId: string, executionId: string): Promise<DataImportReconciliationEntity | null>;
    listByImportId(organizationId: string, importId: string): Promise<DataImportReconciliationEntity[]>;
    clear(): Promise<void>;
}
//# sourceMappingURL=persistent-data-import-reconciliation.repository.d.ts.map