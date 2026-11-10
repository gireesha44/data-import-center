/**
 * In-Memory Data Import Execution Repository Implementation
 */

import { IDataImportExecutionRepository } from '../../domain/repositories/data-import-execution.repository.interface.js';
import { DataImportExecutionEntity } from '../../domain/entities/data-import-execution.entity.js';

export class InMemoryDataImportExecutionRepository implements IDataImportExecutionRepository {
  private executions: Map<string, DataImportExecutionEntity> = new Map();

  public async create(entity: DataImportExecutionEntity): Promise<DataImportExecutionEntity> {
    const key = `${entity.organizationId}:${entity.id}`;
    this.executions.set(key, entity);
    return entity;
  }

  public async findById(
    organizationId: string,
    id: string
  ): Promise<DataImportExecutionEntity | null> {
    const key = `${organizationId}:${id}`;
    return this.executions.get(key) || null;
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
    return Array.from(this.executions.values())
      .filter((e) => e.organizationId === organizationId && e.importId === importId)
      .sort((a, b) => (a.startedAt?.getTime() || 0) - (b.startedAt?.getTime() || 0));
  }

  public async update(entity: DataImportExecutionEntity): Promise<DataImportExecutionEntity> {
    const key = `${entity.organizationId}:${entity.id}`;
    this.executions.set(key, entity);
    return entity;
  }

  public clear(): void {
    this.executions.clear();
  }
}

export const inMemoryDataImportExecutionRepository = new InMemoryDataImportExecutionRepository();
