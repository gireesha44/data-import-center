/**
 * Persistent Data Import Repository Implementation
 * Backed by durable disk storage with multi-tenant isolation, queries, filtering, sorting, and pagination.
 */

import { IDataImportRepository } from '../../domain/repositories/data-import.repository.interface.js';
import { DataImportEntity, DataImportProps } from '../../domain/entities/data-import.entity.js';
import { ImportFilterQuery, PaginatedResult } from '../../core/types/import.types.js';
import { ConflictError } from '../../core/errors/import.errors.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';

const TABLE_NAME = 'data_imports';

export class PersistentDataImportRepository implements IDataImportRepository {
  private async loadAll(): Promise<DataImportEntity[]> {
    const rawRows = await persistentDatabaseEngine.loadTable<DataImportProps>(TABLE_NAME);
    return rawRows.map((r) => new DataImportEntity(r));
  }

  private async saveAll(entities: DataImportEntity[]): Promise<void> {
    await persistentDatabaseEngine.saveTable(TABLE_NAME, entities);
  }

  public async create(entity: DataImportEntity): Promise<DataImportEntity> {
    const entities = await this.loadAll();
    const existing = entities.find((e) => e.id === entity.id);
    if (existing) {
      throw new ConflictError(`Import with ID '${entity.id}' already exists.`);
    }

    entities.push(entity);
    await this.saveAll(entities);
    return entity;
  }

  public async findById(organizationId: string, id: string): Promise<DataImportEntity | null> {
    const entities = await this.loadAll();
    const item = entities.find((e) => e.id === id);
    if (!item || item.organizationId !== organizationId) {
      return null;
    }
    return item;
  }

  public async findMany(
    organizationId: string,
    query: ImportFilterQuery
  ): Promise<PaginatedResult<DataImportEntity>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));

    const all = await this.loadAll();
    let results = all.filter((item) => item.organizationId === organizationId);

    if (query.status) {
      results = results.filter((item) => item.status === query.status);
    }
    if (query.targetModule) {
      results = results.filter(
        (item) => item.targetModule.toLowerCase() === query.targetModule?.toLowerCase()
      );
    }
    if (query.targetEntity) {
      results = results.filter(
        (item) => item.targetEntity.toLowerCase() === query.targetEntity?.toLowerCase()
      );
    }
    if (query.sourceType) {
      results = results.filter((item) => item.sourceType === query.sourceType);
    }
    if (query.createdBy) {
      results = results.filter((item) => item.createdBy === query.createdBy);
    }
    if (query.startDate) {
      const start = new Date(query.startDate).getTime();
      results = results.filter((item) => new Date(item.createdAt).getTime() >= start);
    }
    if (query.endDate) {
      const end = new Date(query.endDate).getTime();
      results = results.filter((item) => new Date(item.createdAt).getTime() <= end);
    }

    // Sorting
    const sortField = (query.sortBy || 'createdAt') as keyof DataImportEntity;
    const sortOrder = query.sortOrder === 'ASC' ? 1 : -1;

    results.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA instanceof Date && valB instanceof Date) {
        return (valA.getTime() - valB.getTime()) * sortOrder;
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB) * sortOrder;
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * sortOrder;
      }
      return 0;
    });

    const total = results.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedData = results.slice(offset, offset + limit);

    return {
      data: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  public async update(entity: DataImportEntity): Promise<DataImportEntity> {
    const entities = await this.loadAll();
    const idx = entities.findIndex(
      (e) => e.id === entity.id && e.organizationId === entity.organizationId
    );

    if (idx === -1) {
      throw new ConflictError(
        `Import with ID '${entity.id}' not found or belongs to another tenant.`
      );
    }

    entity.updatedAt = new Date();
    entities[idx] = entity;
    await this.saveAll(entities);
    return entity;
  }

  public async delete(organizationId: string, id: string): Promise<boolean> {
    let entities = await this.loadAll();
    const existing = entities.find((e) => e.id === id && e.organizationId === organizationId);
    if (!existing) {
      return false;
    }
    entities = entities.filter((e) => e.id !== id);
    await this.saveAll(entities);
    return true;
  }

  public async count(
    organizationId: string,
    query?: Partial<ImportFilterQuery>
  ): Promise<number> {
    const res = await this.findMany(organizationId, { ...query, limit: 1 });
    return res.pagination.total;
  }

  public async clear(): Promise<void> {
    await persistentDatabaseEngine.clearTable(TABLE_NAME);
  }
}
