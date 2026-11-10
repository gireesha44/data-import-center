/**
 * Persistent Audit Service Implementation
 * Stores immutable append-only audit trail entries in persistent disk storage.
 */
import { DataImportAuditLogEntity } from '../../domain/entities/data-import-audit-log.entity.js';
import { logger } from '../../core/logging/structured-logger.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';
const TABLE_NAME = 'data_import_audit_logs';
export class PersistentAuditService {
    async loadAll() {
        const rawRows = await persistentDatabaseEngine.loadTable(TABLE_NAME);
        return rawRows.map((r) => new DataImportAuditLogEntity(r));
    }
    async saveAll(entities) {
        await persistentDatabaseEngine.saveTable(TABLE_NAME, entities);
    }
    async recordEvent(input) {
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
    async getImportAuditTrail(organizationId, importId) {
        const logs = await this.loadAll();
        return logs.filter((log) => log.organizationId === organizationId && log.importId === importId);
    }
    async getAuditTrail(organizationId) {
        const logs = await this.loadAll();
        return logs.filter((log) => log.organizationId === organizationId);
    }
    async clear() {
        await persistentDatabaseEngine.clearTable(TABLE_NAME);
    }
}
export const persistentAuditService = new PersistentAuditService();
//# sourceMappingURL=persistent-audit.service.js.map