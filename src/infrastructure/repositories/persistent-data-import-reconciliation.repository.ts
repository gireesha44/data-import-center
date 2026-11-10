/**
 * Persistent Data Import Reconciliation Repository Implementation
 */

import { IDataImportReconciliationRepository } from '../../domain/repositories/data-import-reconciliation.repository.interface.js';
import {
  DataImportReconciliationEntity,
  DataImportReconciliationProps
} from '../../domain/entities/data-import-reconciliation.entity.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';

const TABLE_NAME = 'data_import_reconciliations';

export class PersistentDataImportReconciliationRepository
  implements IDataImportReconciliationRepository {
  private async loadAll(): Promise<DataImportReconciliationEntity[]> {
    const rawRows = await persistentDatabaseEngine.loadTable<DataImportReconciliationProps>(TABLE_NAME);
    return rawRows.map((r) => new DataImportReconciliationEntity(r));
  }

  private async saveAll(entities: DataImportReconciliationEntity[]): Promise<void> {
    await persistentDatabaseEngine.saveTable(TABLE_NAME, entities);
  }

  public async create(
    reconciliation: DataImportReconciliationEntity
  ): Promise<DataImportReconciliationEntity> {
    const entities = await this.loadAll();
    entities.push(reconciliation);
    await this.saveAll(entities);
    return reconciliation;
  }

  public async findById(
    organizationId: string,
    id: string
  ): Promise<DataImportReconciliationEntity | null> {
    const entities = await this.loadAll();
    const found = entities.find((r) => r.id === id && r.organizationId === organizationId);
    return found ?? null;
  }

  public async findByImportId(
    organizationId: string,
    importId: string
  ): Promise<DataImportReconciliationEntity | null> {
    const list = await this.listByImportId(organizationId, importId);
    return list.length > 0 ? list[list.length - 1] : null;
  }

  public async findByExecutionId(
    organizationId: string,
    executionId: string
  ): Promise<DataImportReconciliationEntity | null> {
    const entities = await this.loadAll();
    const found = entities.find(
      (r) => r.executionId === executionId && r.organizationId === organizationId
    );
    return found ?? null;
  }

  public async listByImportId(
    organizationId: string,
    importId: string
  ): Promise<DataImportReconciliationEntity[]> {
    const entities = await this.loadAll();
    return entities.filter(
      (r) => r.importId === importId && r.organizationId === organizationId
    );
  }

  public async clear(): Promise<void> {
    await persistentDatabaseEngine.clearTable(TABLE_NAME);
  }
}
