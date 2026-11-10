/**
 * Audit Service Implementation
 */
import { DataImportAuditLogEntity } from '../../domain/entities/data-import-audit-log.entity.js';
import { logger } from '../../core/logging/structured-logger.js';
export class AuditService {
    auditLogs = [];
    sequence = 1;
    async recordEvent(input) {
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
    async getImportAuditTrail(organizationId, importId) {
        return this.auditLogs.filter((log) => log.organizationId === organizationId && log.importId === importId);
    }
    async getAuditTrail(organizationId) {
        return this.auditLogs.filter((log) => log.organizationId === organizationId);
    }
    clear() {
        this.auditLogs = [];
        this.sequence = 1;
    }
}
export const auditService = new AuditService();
//# sourceMappingURL=audit.service.js.map