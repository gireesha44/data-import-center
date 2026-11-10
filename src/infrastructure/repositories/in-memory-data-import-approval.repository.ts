/**
 * In-Memory Data Import Approval Repository Implementation
 */

import { IDataImportApprovalRepository } from '../../domain/repositories/data-import-approval.repository.interface.js';
import { DataImportApprovalEntity } from '../../domain/entities/data-import-approval.entity.js';

export class InMemoryDataImportApprovalRepository implements IDataImportApprovalRepository {
  private approvals: Map<string, DataImportApprovalEntity> = new Map();

  public async create(entity: DataImportApprovalEntity): Promise<DataImportApprovalEntity> {
    const key = `${entity.organizationId}:${entity.id}`;
    this.approvals.set(key, entity);
    return entity;
  }

  public async findById(
    organizationId: string,
    id: string
  ): Promise<DataImportApprovalEntity | null> {
    const key = `${organizationId}:${id}`;
    return this.approvals.get(key) || null;
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
    return Array.from(this.approvals.values())
      .filter((a) => a.organizationId === organizationId && a.importId === importId)
      .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
  }

  public async update(entity: DataImportApprovalEntity): Promise<DataImportApprovalEntity> {
    const key = `${entity.organizationId}:${entity.id}`;
    this.approvals.set(key, entity);
    return entity;
  }

  public clear(): void {
    this.approvals.clear();
  }
}

export const inMemoryDataImportApprovalRepository = new InMemoryDataImportApprovalRepository();
