/**
 * Data Import Audit Log Domain Entity
 */
export interface DataImportAuditLogProps {
    id?: number | string;
    organizationId: string;
    importId: string;
    executionId?: string | null;
    actorUserId?: string | null;
    action: string;
    fromState?: string | null;
    toState?: string | null;
    details?: Record<string, unknown>;
    timestamp?: Date;
}
export declare class DataImportAuditLogEntity {
    readonly id?: number | string;
    readonly organizationId: string;
    readonly importId: string;
    readonly executionId: string | null;
    readonly actorUserId: string | null;
    readonly action: string;
    readonly fromState: string | null;
    readonly toState: string | null;
    readonly details: Record<string, unknown>;
    readonly timestamp: Date;
    constructor(props: DataImportAuditLogProps);
    toJSON(): {
        id: string | number | undefined;
        organizationId: string;
        importId: string;
        executionId: string | null;
        actorUserId: string | null;
        action: string;
        fromState: string | null;
        toState: string | null;
        details: Record<string, unknown>;
        timestamp: string;
    };
}
//# sourceMappingURL=data-import-audit-log.entity.d.ts.map