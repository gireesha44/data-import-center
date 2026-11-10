/**
 * Audit Service Implementation
 */
import { IAuditService, RecordAuditEventInput } from '../../domain/services/audit.service.interface.js';
import { DataImportAuditLogEntity } from '../../domain/entities/data-import-audit-log.entity.js';
export declare class AuditService implements IAuditService {
    private auditLogs;
    private sequence;
    recordEvent(input: RecordAuditEventInput): Promise<DataImportAuditLogEntity>;
    getImportAuditTrail(organizationId: string, importId: string): Promise<DataImportAuditLogEntity[]>;
    getAuditTrail(organizationId: string): Promise<DataImportAuditLogEntity[]>;
    clear(): void;
}
export declare const auditService: AuditService;
//# sourceMappingURL=audit.service.d.ts.map