/**
 * Persistent Audit Service Implementation
 * Stores immutable append-only audit trail entries in persistent disk storage.
 */

import { IAuditService, RecordAuditEventInput } from '../../domain/services/audit.service.interface.js';
import {
  DataImportAuditLogEntity,
  DataImportAuditLogProps
} from '../../domain/entities/data-import-audit-log.entity.js';
import { logger } from '../../core/logging/structured-logger.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';

const TABLE_NAME = 'data_import_audit_logs';

export class PersistentAuditService implements IAuditService {
  private async loadAll(): Promise<DataImportAuditLogEntity[]> {
    const rawRows = await persistentDatabaseEngine.loadTable<DataImportAuditLogProps>(TABLE_NAME);
    return rawRows.map((r) => new DataImportAuditLogEntity(r));
  }

  private async saveAll(entities: DataImportAuditLogEntity[]): Promise<void> {
    await persistentDatabaseEngine.saveTable(TABLE_NAME, entities);
  }

  public async recordEvent(input: RecordAuditEventInput): Promise<DataImportAuditLogEntity> {
    const logs = await this.loadAll();
    const sequence = logs.length > 0 ? Math.max(...logs.map((l) => Number(l.id) || 0)) + 1 : 1;

    const entry = new DataImportAuditLogEntity({
      id: sequence,
      organizationId: input.organizationId,
      importId: input.importId,
      executionId: input.executionId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      fromState: input.fromState ?? null,
      toState: input.toState ?? null,
      details: input.details ?? {},
      timestamp: new Date()
    });

    logs.push(entry);
    await this.saveAll(logs);

    logger.info(`[AUDIT] Action: ${input.action}`, {
      importId: input.importId,
      organizationId: input.organizationId,
      userId: input.actorUserId || undefined,
      operation: input.action
    });

    return entry;
  }

  public async getImportAuditTrail(
    organizationId: string,
    importId: string
  ): Promise<DataImportAuditLogEntity[]> {
    const logs = await this.loadAll();
    return logs.filter(
      (log) => log.organizationId === organizationId && log.importId === importId
    );
  }

  public async getAuditTrail(
    organizationId: string
  ): Promise<DataImportAuditLogEntity[]> {
    const logs = await this.loadAll();
    return logs.filter((log) => log.organizationId === organizationId);
  }

  public async clear(): Promise<void> {
    await persistentDatabaseEngine.clearTable(TABLE_NAME);
  }
}

export const persistentAuditService = new PersistentAuditService();
