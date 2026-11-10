/**
 * Persistent Data Import Execution Repository Implementation
 */

import { IDataImportExecutionRepository } from '../../domain/repositories/data-import-execution.repository.interface.js';
import {
  DataImportExecutionEntity,
  DataImportExecutionProps
} from '../../domain/entities/data-import-execution.entity.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';

const TABLE_NAME = 'data_import_executions';

export class PersistentDataImportExecutionRepository implements IDataImportExecutionRepository {
  private async loadAll(): Promise<DataImportExecutionEntity[]> {
    const rawRows = await persistentDatabaseEngine.loadTable<DataImportExecutionProps>(TABLE_NAME);
    return rawRows.map((r) => new DataImportExecutionEntity(r));
  }

  private async saveAll(entities: DataImportExecutionEntity[]): Promise<void> {
    await persistentDatabaseEngine.saveTable(TABLE_NAME, entities);
  }

  public async create(entity: DataImportExecutionEntity): Promise<DataImportExecutionEntity> {
    const entities = await this.loadAll();
    entities.push(entity);
    await this.saveAll(entities);
    return entity;
  }

  public async findById(
    organizationId: string,
    id: string
  ): Promise<DataImportExecutionEntity | null> {
    const entities = await this.loadAll();
    const found = entities.find((e) => e.id === id && e.organizationId === organizationId);
    return found ?? null;
  }

  public async findByImportId(
    organizationId: string,
    importId: string
  ): Promise<DataImportExecutionEntity | null> {
    const list = await this.listByImportId(organizationId, importId);
    return list.length > 0 ? list[list.length - 1] : null;
  }

  public async listByImportId(
    organizationId: string,
    importId: string
  ): Promise<DataImportExecutionEntity[]> {
    const entities = await this.loadAll();
    return entities.filter(
      (e) => e.importId === importId && e.organizationId === organizationId
    );
  }

  public async update(entity: DataImportExecutionEntity): Promise<DataImportExecutionEntity> {
    const entities = await this.loadAll();
    const idx = entities.findIndex(
      (e) => e.id === entity.id && e.organizationId === entity.organizationId
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
