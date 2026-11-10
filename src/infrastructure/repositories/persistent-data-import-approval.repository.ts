/**
 * Persistent Data Import Approval Repository Implementation
 */

import { IDataImportApprovalRepository } from '../../domain/repositories/data-import-approval.repository.interface.js';
import {
  DataImportApprovalEntity,
  DataImportApprovalProps
} from '../../domain/entities/data-import-approval.entity.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';

const TABLE_NAME = 'data_import_approvals';

export class PersistentDataImportApprovalRepository implements IDataImportApprovalRepository {
  private async loadAll(): Promise<DataImportApprovalEntity[]> {
    const rawRows = await persistentDatabaseEngine.loadTable<DataImportApprovalProps>(TABLE_NAME);
    return rawRows.map((r) => new DataImportApprovalEntity(r));
  }

  private async saveAll(entities: DataImportApprovalEntity[]): Promise<void> {
    await persistentDatabaseEngine.saveTable(TABLE_NAME, entities);
  }

  public async create(entity: DataImportApprovalEntity): Promise<DataImportApprovalEntity> {
    const entities = await this.loadAll();
    entities.push(entity);
    await this.saveAll(entities);
    return entity;
  }

  public async findById(
    organizationId: string,
    id: string
  ): Promise<DataImportApprovalEntity | null> {
    const entities = await this.loadAll();
    const found = entities.find((a) => a.id === id && a.organizationId === organizationId);
    return found ?? null;
  }

  public async findByImportId(
    organizationId: string,
    importId: string
  ): Promise<DataImportApprovalEntity | null> {
    const list = await this.listByImportId(organizationId, importId);
    return list.length > 0 ? list[list.length - 1] : null;
  }

  public async listByImportId(
    organizationId: string,
    importId: string
  ): Promise<DataImportApprovalEntity[]> {
    const entities = await this.loadAll();
    return entities.filter(
      (a) => a.importId === importId && a.organizationId === organizationId
    );
  }

  public async update(entity: DataImportApprovalEntity): Promise<DataImportApprovalEntity> {
    const entities = await this.loadAll();
    const idx = entities.findIndex(
      (a) => a.id === entity.id && a.organizationId === entity.organizationId
    );
    if (idx !== -1) {
      entities[idx] = entity;
      await this.saveAll(entities);
    }
    return entity;
  }

  public async clear(): Promise<void> {
    await persistentDatabaseEngine.clearTable(TABLE_NAME);
  }
}
