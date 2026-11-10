/**
 * In-Memory Data Import Repository Implementation
 * Provides robust multi-tenant queries, filtering, sorting, and pagination.
 */

import { IDataImportRepository } from '../../domain/repositories/data-import.repository.interface.js';
import { DataImportEntity } from '../../domain/entities/data-import.entity.js';
import { ImportFilterQuery, PaginatedResult } from '../../core/types/import.types.js';
import { ConflictError } from '../../core/errors/import.errors.js';

export class InMemoryDataImportRepository implements IDataImportRepository {
  private imports: Map<string, DataImportEntity> = new Map();

  public async create(entity: DataImportEntity): Promise<DataImportEntity> {
    if (this.imports.has(entity.id)) {
      throw new ConflictError(`Import with ID '${entity.id}' already exists.`);
    }
    this.imports.set(entity.id, entity);
    return entity;
  }

  public async findById(organizationId: string, id: string): Promise<DataImportEntity | null> {
    const item = this.imports.get(id);
    if (!item) return null;
    // Strict Tenant Isolation check
    if (item.organizationId !== organizationId) {
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

    // Filter by organizationId strictly
    let results = Array.from(this.imports.values()).filter(
      (item) => item.organizationId === organizationId
    );

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
      results = results.filter((item) => item.createdAt.getTime() >= start);
    }
    if (query.endDate) {
      const end = new Date(query.endDate).getTime();
      results = results.filter((item) => item.createdAt.getTime() <= end);
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
    const existing = this.imports.get(entity.id);
    if (!existing || existing.organizationId !== entity.organizationId) {
      throw new ConflictError(`Import with ID '${entity.id}' not found or belongs to another tenant.`);
    }

    this.imports.set(entity.id, entity);
    return entity;
  }

  public async delete(organizationId: string, id: string): Promise<boolean> {
    const existing = this.imports.get(id);
    if (!existing || existing.organizationId !== organizationId) {
      return false;
    }
    return this.imports.delete(id);
  }

  public async count(
    organizationId: string,
    query?: Partial<ImportFilterQuery>
  ): Promise<number> {
    const res = await this.findMany(organizationId, { ...query, limit: 1 });
    return res.pagination.total;
  }

  public clear(): void {
    this.imports.clear();
  }
}
