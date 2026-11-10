/**
 * Data Import Audit Log Domain Entity
 */
export class DataImportAuditLogEntity {
    id;
    organizationId;
    importId;
    executionId;
    actorUserId;
    action;
    fromState;
    toState;
    details;
    timestamp;
    constructor(props) {
        this.id = props.id;
        this.organizationId = props.organizationId;
        this.importId = props.importId;
        this.executionId = props.executionId ?? null;
        this.actorUserId = props.actorUserId ?? null;
        this.action = props.action;
        this.fromState = props.fromState ?? null;
        this.toState = props.toState ?? null;
        this.details = props.details ?? {};
        this.timestamp = props.timestamp ? (props.timestamp instanceof Date ? props.timestamp : new Date(props.timestamp)) : new Date();
    }
    toJSON() {
        return {
            id: this.id,
            organizationId: this.organizationId,
            importId: this.importId,
            executionId: this.executionId,
            actorUserId: this.actorUserId,
            action: this.action,
            fromState: this.fromState,
            toState: this.toState,
            details: this.details,
            timestamp: this.timestamp.toISOString()
        };
    }
}
//# sourceMappingURL=data-import-audit-log.entity.js.map