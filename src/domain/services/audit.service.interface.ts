/**
 * Audit Service Interface
 */

import { DataImportAuditLogEntity } from '../entities/data-import-audit-log.entity.js';

export interface RecordAuditEventInput {
  organizationId: string;
  importId: string;
  executionId?: string | null;
  actorUserId?: string | null;
  action: string;
  fromState?: string | null;
  toState?: string | null;
  details?: Record<string, unknown>;
}

export interface IAuditService {
  recordEvent(input: RecordAuditEventInput): Promise<DataImportAuditLogEntity>;
  getImportAuditTrail(
    organizationId: string,
    importId: string
  ): Promise<DataImportAuditLogEntity[]>;
}
