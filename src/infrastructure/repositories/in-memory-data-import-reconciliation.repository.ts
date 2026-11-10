/**
 * In-Memory Implementation of Data Import Reconciliation Repository
 */

import { IDataImportReconciliationRepository } from '../../domain/repositories/data-import-reconciliation.repository.interface.js';
import { DataImportReconciliationEntity } from '../../domain/entities/data-import-reconciliation.entity.js';

export class InMemoryDataImportReconciliationRepository implements IDataImportReconciliationRepository {
  private reconciliations: Map<string, DataImportReconciliationEntity> = new Map();

  private getKey(organizationId: string, id: string): string {
    return `${organizationId}:${id}`;
  }

  public async create(
    reconciliation: DataImportReconciliationEntity
  ): Promise<DataImportReconciliationEntity> {
    const key = this.getKey(reconciliation.organizationId, reconciliation.id);
    this.reconciliations.set(key, reconciliation);
    return reconciliation;
  }

  public async findById(
    organizationId: string,
    id: string
  ): Promise<DataImportReconciliationEntity | null> {
    const key = this.getKey(organizationId, id);
    const rec = this.reconciliations.get(key);
    return rec || null;
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
    for (const rec of this.reconciliations.values()) {
      if (rec.organizationId === organizationId && rec.executionId === executionId) {
        return rec;
      }
    }
    return null;
  }

  public async listByImportId(
    organizationId: string,
    importId: string
  ): Promise<DataImportReconciliationEntity[]> {
    const results: DataImportReconciliationEntity[] = [];
    for (const rec of this.reconciliations.values()) {
      if (rec.organizationId === organizationId && rec.importId === importId) {
        results.push(rec);
      }
    }
    return results.sort((a, b) => a.reconciledAt.getTime() - b.reconciledAt.getTime());
  }

  public async clear(): Promise<void> {
    this.reconciliations.clear();
  }
}
