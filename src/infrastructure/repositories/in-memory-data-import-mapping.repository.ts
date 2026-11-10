/**
 * In-Memory Data Import Mapping Repository Implementation
 */

import { IDataImportMappingRepository } from '../../domain/repositories/data-import-mapping.repository.interface.js';
import { DataImportMappingEntity } from '../../domain/entities/data-import-mapping.entity.js';

export class InMemoryDataImportMappingRepository implements IDataImportMappingRepository {
  private mappingsByImportId: Map<string, DataImportMappingEntity> = new Map();

  public async save(mapping: DataImportMappingEntity): Promise<DataImportMappingEntity> {
    const key = `${mapping.organizationId}:${mapping.importId}`;
    mapping.updatedAt = new Date();
    this.mappingsByImportId.set(key, mapping);
    return mapping;
  }

  public async findByImportId(
    organizationId: string,
    importId: string
  ): Promise<DataImportMappingEntity | null> {
    const key = `${organizationId}:${importId}`;
    return this.mappingsByImportId.get(key) || null;
  }

  public async deleteByImportId(
    organizationId: string,
    importId: string
  ): Promise<boolean> {
    const key = `${organizationId}:${importId}`;
    return this.mappingsByImportId.delete(key);
  }

  public clear(): void {
    this.mappingsByImportId.clear();
  }
}
