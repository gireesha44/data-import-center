/**
 * Data Import Staged Record Domain Entity
 */
import { RecordStatus } from '../../core/types/import.types.js';
export class DataImportRecordEntity {
    id;
    organizationId;
    importId;
    rowIndex;
    rawData;
    transformedData;
    transformationAudit;
    status;
    validationErrors;
    isDuplicate;
    duplicateMatchId;
    duplicateStrategy;
    targetRecordId;
    matchClassification;
    matchKey;
    matchKeyHash;
    candidateTargetIds;
    executionAction;
    executionReason;
    isBlocked;
    blockedReason;
    executionError;
    errorCode;
    errorMessage;
    retryCount;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.organizationId = props.organizationId;
        this.importId = props.importId;
        this.rowIndex = props.rowIndex;
        this.rawData = props.rawData;
        this.transformedData = props.transformedData ?? null;
        this.transformationAudit = props.transformationAudit ?? {};
        this.status = props.status ?? RecordStatus.PENDING;
        this.validationErrors = props.validationErrors ?? [];
        this.isDuplicate = props.isDuplicate ?? false;
        this.duplicateMatchId = props.duplicateMatchId ?? null;
        this.duplicateStrategy = props.duplicateStrategy ?? null;
        this.targetRecordId = props.targetRecordId ?? null;
        this.matchClassification = props.matchClassification ?? null;
        this.matchKey = props.matchKey ?? null;
        this.matchKeyHash = props.matchKeyHash ?? null;
        this.candidateTargetIds = props.candidateTargetIds ?? [];
        this.executionAction = props.executionAction ?? null;
        this.executionReason = props.executionReason ?? null;
        this.isBlocked = props.isBlocked ?? false;
        this.blockedReason = props.blockedReason ?? null;
        this.executionError = props.executionError ?? null;
        this.errorCode = props.errorCode ?? null;
        this.errorMessage = props.errorMessage ?? null;
        this.retryCount = props.retryCount ?? 0;
        this.createdAt = props.createdAt ? (props.createdAt instanceof Date ? props.createdAt : new Date(props.createdAt)) : new Date();
        this.updatedAt = props.updatedAt ? (props.updatedAt instanceof Date ? props.updatedAt : new Date(props.updatedAt)) : new Date();
    }
    hasErrors() {
        return this.validationErrors.some((e) => e.severity === 'ERROR');
    }
    hasWarnings() {
        return this.validationErrors.some((e) => e.severity === 'WARNING');
    }
    toJSON() {
        return {
            id: this.id,
            organizationId: this.organizationId,
            importId: this.importId,
            rowIndex: this.rowIndex,
            rawData: this.rawData,
            transformedData: this.transformedData,
            transformationAudit: this.transformationAudit,
            status: this.status,
            validationErrors: this.validationErrors,
            isDuplicate: this.isDuplicate,
            duplicateMatchId: this.duplicateMatchId,
            duplicateStrategy: this.duplicateStrategy,
            targetRecordId: this.targetRecordId,
            matchClassification: this.matchClassification,
            matchKey: this.matchKey,
            matchKeyHash: this.matchKeyHash,
            candidateTargetIds: this.candidateTargetIds,
            executionAction: this.executionAction,
            executionReason: this.executionReason,
            isBlocked: this.isBlocked,
            blockedReason: this.blockedReason,
            executionError: this.executionError,
            retryCount: this.retryCount,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };
    }
}
//# sourceMappingURL=data-import-record.entity.js.map