/**
 * Persistent Data Import Mapping Repository Implementation
 */

import { IDataImportMappingRepository } from '../../domain/repositories/data-import-mapping.repository.interface.js';
import {
  DataImportMappingEntity,
  DataImportMappingProps
} from '../../domain/entities/data-import-mapping.entity.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';

const TABLE_NAME = 'data_import_mappings';

export class PersistentDataImportMappingRepository implements IDataImportMappingRepository {
  private async loadAll(): Promise<DataImportMappingEntity[]> {
    const rawRows = await persistentDatabaseEngine.loadTable<DataImportMappingProps>(TABLE_NAME);
    return rawRows.map((r) => new DataImportMappingEntity(r));
  }

  private async saveAll(entities: DataImportMappingEntity[]): Promise<void> {
    await persistentDatabaseEngine.saveTable(TABLE_NAME, entities);
  }

  public async save(mapping: DataImportMappingEntity): Promise<DataImportMappingEntity> {
    const entities = await this.loadAll();
    const idx = entities.findIndex(
      (m) => m.importId === mapping.importId && m.organizationId === mapping.organizationId
    );

    mapping.updatedAt = new Date();
    if (idx !== -1) {
      entities[idx] = mapping;
    } else {
      entities.push(mapping);
    }

    await this.saveAll(entities);
    return mapping;
  }

  public async findByImportId(
    organizationId: string,
    importId: string
  ): Promise<DataImportMappingEntity | null> {
    const entities = await this.loadAll();
    const item = entities.find(
      (m) => m.importId === importId && m.organizationId === organizationId
    );
    return item ?? null;
  }

  public async deleteByImportId(organizationId: string, importId: string): Promise<boolean> {
    let entities = await this.loadAll();
    const existing = entities.find(
      (m) => m.importId === importId && m.organizationId === organizationId
    );
    if (!existing) return false;

    entities = entities.filter((m) => !(m.importId === importId && m.organizationId === organizationId));
    await this.saveAll(entities);
    return true;
  }

  public async clear(): Promise<void> {
    await persistentDatabaseEngine.clearTable(TABLE_NAME);
  }
}
