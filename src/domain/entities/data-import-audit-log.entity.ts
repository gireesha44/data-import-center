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

export class DataImportAuditLogEntity {
  public readonly id?: number | string;
  public readonly organizationId: string;
  public readonly importId: string;
  public readonly executionId: string | null;
  public readonly actorUserId: string | null;
  public readonly action: string;
  public readonly fromState: string | null;
  public readonly toState: string | null;
  public readonly details: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(props: DataImportAuditLogProps) {
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

  public toJSON() {
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
