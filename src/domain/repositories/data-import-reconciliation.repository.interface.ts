/**
 * Data Import Reconciliation Repository Interface
 */

import { DataImportReconciliationEntity } from '../entities/data-import-reconciliation.entity.js';

export interface IDataImportReconciliationRepository {
  create(reconciliation: DataImportReconciliationEntity): Promise<DataImportReconciliationEntity>;
  findById(organizationId: string, id: string): Promise<DataImportReconciliationEntity | null>;
  findByImportId(organizationId: string, importId: string): Promise<DataImportReconciliationEntity | null>;
  findByExecutionId(organizationId: string, executionId: string): Promise<DataImportReconciliationEntity | null>;
  listByImportId(organizationId: string, importId: string): Promise<DataImportReconciliationEntity[]>;
  clear(): Promise<void>;
}
