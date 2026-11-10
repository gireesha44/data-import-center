/**
 * Persistent Staged Data Import Record Repository Implementation
 * Backed by durable disk storage with full filter, search, duplicate, status, and pagination logic.
 */

import {
  IDataImportRecordRepository,
  RecordFilterOptions
} from '../../domain/repositories/data-import-record.repository.interface.js';
import {
  DataImportRecordEntity,
  DataImportRecordProps
} from '../../domain/entities/data-import-record.entity.js';
import { PaginatedResult } from '../../core/types/import.types.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';

const TABLE_NAME = 'data_import_records';

export class PersistentDataImportRecordRepository implements IDataImportRecordRepository {
  private async loadAll(): Promise<DataImportRecordEntity[]> {
    const rawRows = await persistentDatabaseEngine.loadTable<DataImportRecordProps>(TABLE_NAME);
    return rawRows.map((r) => new DataImportRecordEntity(r));
  }

  private async saveAll(entities: DataImportRecordEntity[]): Promise<void> {
    await persistentDatabaseEngine.saveTable(TABLE_NAME, entities);
  }

  public async saveBatch(records: DataImportRecordEntity[]): Promise<void> {
    if (records.length === 0) return;

    const allRecords = await this.loadAll();

    const orgId = records[0].organizationId;
    const importId = records[0].importId;

    // Filter records belonging to other imports/orgs
    const otherRecords = allRecords.filter(
      (r) => !(r.organizationId === orgId && r.importId === importId)
    );

    // Get existing records for this import
    const existingImportRecords = allRecords.filter(
      (r) => r.organizationId === orgId && r.importId === importId
    );

    const updatedMap = new Map<number, DataImportRecordEntity>();
    for (const r of existingImportRecords) {
      updatedMap.set(r.rowIndex, r);
    }
    for (const r of records) {
      updatedMap.set(r.rowIndex, r);
    }

    const sortedImportRecords = Array.from(updatedMap.values()).sort(
      (a, b) => a.rowIndex - b.rowIndex
    );

    await this.saveAll([...otherRecords, ...sortedImportRecords]);
  }

  public async findByImportId(
    organizationId: string,
    importId: string,
    options: RecordFilterOptions = {}
  ): Promise<PaginatedResult<DataImportRecordEntity>> {
    const allRecords = await this.loadAll();
    const importRecords = allRecords.filter(
      (r) => r.organizationId === organizationId && r.importId === importId
    );

    let filtered = importRecords;
    if (options.status) {
      const s = String(options.status).toUpperCase();
      if (s === 'CORRECTED' || s === 'AUTO_CORRECTED') {
        filtered = filtered.filter(
          (r) =>
            r.status === 'AUTO_CORRECTED' ||
            (r.transformationAudit && Object.keys(r.transformationAudit).length > 0)
        );
      } else if (s === 'NEEDS_ACTION') {
        filtered = filtered.filter(
          (r) => (r.validationErrors || []).some(
            (error) => ['ERROR', 'WARNING'].includes(String(error.severity).toUpperCase())
          )
        );
      } else if (s === 'DUPLICATE' || s === 'DUPLICATES') {
        filtered = filtered.filter(
          (r) =>
            r.status === 'DUPLICATE' ||
            r.isDuplicate ||
            (r.validationErrors || []).some(
              (e) => e.code?.includes('DUP') || e.code?.includes('DUPLICATE')
            )
        );
      } else if (s !== 'ALL') {
        filtered = filtered.filter((r) => r.status === s);
      }
    }
    if (options.statuses && options.statuses.length > 0) {
      filtered = filtered.filter((r) => options.statuses!.includes(r.status));
    }
    if (options.requiresAction) {
      filtered = filtered.filter(
        (r) => (r.validationErrors || []).some(
          (error) => ['ERROR', 'WARNING'].includes(String(error.severity).toUpperCase())
        )
      );
    }
    if (options.errorCode) {
      const code = options.errorCode.toUpperCase();
      if (code === 'DUPLICATE' || code === 'DUPLICATES' || code === 'DUPLICATE_IN_FILE') {
        filtered = filtered.filter(
          (r) =>
            r.isDuplicate ||
            (r.validationErrors || []).some(
              (e) => e.code?.includes('DUP') || e.code?.includes('DUPLICATE')
            )
        );
      } else {
        filtered = filtered.filter((r) =>
          (r.validationErrors || []).some(
            (e) =>
              e.code?.toUpperCase() === code ||
              e.code?.toUpperCase().includes(code) ||
              code.includes(e.code?.toUpperCase() || '')
          )
        );
      }
    }
    if (options.column) {
      const col = options.column;
      filtered = filtered.filter(
        (r) =>
          (r.validationErrors || []).some((e) => e.field === col) ||
          Object.keys(r.transformationAudit || {}).includes(col) ||
          Object.prototype.hasOwnProperty.call(r.rawData || {}, col) ||
          Object.prototype.hasOwnProperty.call(r.transformedData || {}, col)
      );
    }
    if (options.search) {
      const q = options.search.toLowerCase().trim();
      filtered = filtered.filter((r) => {
        if (String(r.rowIndex).includes(q)) return true;
        const rawStr = JSON.stringify(r.rawData || {}).toLowerCase();
        if (rawStr.includes(q)) return true;
        const transStr = JSON.stringify(r.transformedData || {}).toLowerCase();
        if (transStr.includes(q)) return true;
        const auditStr = JSON.stringify(r.transformationAudit || {}).toLowerCase();
        if (auditStr.includes(q)) return true;
        const errStr = JSON.stringify(r.validationErrors || []).toLowerCase();
        if (errStr.includes(q)) return true;
        return false;
      });
    }
    if (options.classification) {
      filtered = filtered.filter((r) => r.matchClassification === options.classification);
    }
    if (options.executionAction) {
      filtered = filtered.filter((r) => r.executionAction === options.executionAction);
    }
    if (options.isDuplicate !== undefined) {
      filtered = filtered.filter((r) => r.isDuplicate === options.isDuplicate);
    }
    if (options.isBlocked !== undefined) {
      filtered = filtered.filter((r) => r.isBlocked === options.isBlocked);
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(500, Math.max(1, options.limit || 50));
    const offset = (page - 1) * limit;

    const paginated = filtered.slice(offset, offset + limit);
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data: paginated,
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

  public async findById(
    organizationId: string,
    id: string
  ): Promise<DataImportRecordEntity | null> {
    const allRecords = await this.loadAll();
    const found = allRecords.find(
      (r) => r.id === id && r.organizationId === organizationId
    );
    return found ?? null;
  }

  public async countByStatus(
    organizationId: string,
    importId: string
  ): Promise<Record<string, number>> {
    const allRecords = await this.loadAll();
    const records = allRecords.filter(
      (r) => r.organizationId === organizationId && r.importId === importId
    );

    const counts: Record<string, number> = {};
    for (const r of records) {
      counts[r.status] = (counts[r.status] || 0) + 1;
    }

    return counts;
  }

  public async deleteByImportId(
    organizationId: string,
    importId: string
  ): Promise<void> {
    const allRecords = await this.loadAll();
    const remaining = allRecords.filter(
      (r) => !(r.organizationId === organizationId && r.importId === importId)
    );
    await this.saveAll(remaining);
  }

  public async clear(): Promise<void> {
    await persistentDatabaseEngine.clearTable(TABLE_NAME);
  }
}
