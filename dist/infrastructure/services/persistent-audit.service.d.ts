/**
 * Persistent Audit Service Implementation
 * Stores immutable append-only audit trail entries in persistent disk storage.
 */
import { IAuditService, RecordAuditEventInput } from '../../domain/services/audit.service.interface.js';
import { DataImportAuditLogEntity } from '../../domain/entities/data-import-audit-log.entity.js';
export declare class PersistentAuditService implements IAuditService {
    private loadAll;
    private saveAll;
    recordEvent(input: RecordAuditEventInput): Promise<DataImportAuditLogEntity>;
    getImportAuditTrail(organizationId: string, importId: string): Promise<DataImportAuditLogEntity[]>;
    getAuditTrail(organizationId: string): Promise<DataImportAuditLogEntity[]>;
    clear(): Promise<void>;
}
export declare const persistentAuditService: PersistentAuditService;
//# sourceMappingURL=persistent-audit.service.d.ts.map