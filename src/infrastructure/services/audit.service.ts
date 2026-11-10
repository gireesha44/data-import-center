/**
 * Audit Service Implementation
 */

import { IAuditService, RecordAuditEventInput } from '../../domain/services/audit.service.interface.js';
import { DataImportAuditLogEntity } from '../../domain/entities/data-import-audit-log.entity.js';
import { logger } from '../../core/logging/structured-logger.js';

export class AuditService implements IAuditService {
  private auditLogs: DataImportAuditLogEntity[] = [];
  private sequence = 1;

  public async recordEvent(input: RecordAuditEventInput): Promise<DataImportAuditLogEntity> {
    const entry = new DataImportAuditLogEntity({
      id: this.sequence++,
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

    this.auditLogs.push(entry);

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
    return this.auditLogs.filter(
      (log) => log.organizationId === organizationId && log.importId === importId
    );
  }

  public async getAuditTrail(
    organizationId: string
  ): Promise<DataImportAuditLogEntity[]> {
    return this.auditLogs.filter((log) => log.organizationId === organizationId);
  }

  public clear(): void {
    this.auditLogs = [];
    this.sequence = 1;
  }
}

export const auditService = new AuditService();
