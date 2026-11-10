/**
 * Master Data Import Domain Entity
 */
import { ImportStatus, ImportSourceType, DuplicateStrategy, ErrorStrategy } from '../../core/types/import.types.js';
export class DataImportEntity {
    id;
    organizationId;
    sourceId;
    targetModule;
    targetEntity;
    name;
    status;
    sourceType;
    fileName;
    fileSizeBytes;
    fileMimeType;
    fileStoragePath;
    fileChecksumSha256;
    fileMetadata;
    importOptions;
    totalRecords;
    validRecords;
    invalidRecords;
    warningRecords;
    processedRecords;
    failedRecords;
    skippedRecords;
    requiresApproval;
    createdBy;
    createdAt;
    updatedAt;
    startedAt;
    completedAt;
    cancelledAt;
    version;
    constructor(props) {
        this.id = props.id;
        this.organizationId = props.organizationId;
        this.sourceId = props.sourceId ?? null;
        this.targetModule = props.targetModule;
        this.targetEntity = props.targetEntity;
        this.name = props.name;
        this.status = props.status ?? ImportStatus.DRAFT;
        this.sourceType = props.sourceType ?? ImportSourceType.FILE_UPLOAD;
        this.fileName = props.fileName ?? null;
        this.fileSizeBytes = props.fileSizeBytes ?? null;
        this.fileMimeType = props.fileMimeType ?? null;
        this.fileStoragePath = props.fileStoragePath ?? null;
        this.fileChecksumSha256 = props.fileChecksumSha256 ?? null;
        this.fileMetadata = props.fileMetadata ?? null;
        this.importOptions = {
            duplicateStrategy: props.importOptions?.duplicateStrategy ?? DuplicateStrategy.SKIP,
            errorStrategy: props.importOptions?.errorStrategy ?? ErrorStrategy.CONTINUE_ON_ERROR,
            batchSize: props.importOptions?.batchSize ?? 500,
            skipHeaderRows: props.importOptions?.skipHeaderRows ?? 0,
            ...props.importOptions
        };
        this.totalRecords = props.totalRecords ?? 0;
        this.validRecords = props.validRecords ?? 0;
        this.invalidRecords = props.invalidRecords ?? 0;
        this.warningRecords = props.warningRecords ?? 0;
        this.processedRecords = props.processedRecords ?? 0;
        this.failedRecords = props.failedRecords ?? 0;
        this.skippedRecords = props.skippedRecords ?? 0;
        this.requiresApproval = props.requiresApproval ?? false;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt ? (props.createdAt instanceof Date ? props.createdAt : new Date(props.createdAt)) : new Date();
        this.updatedAt = props.updatedAt ? (props.updatedAt instanceof Date ? props.updatedAt : new Date(props.updatedAt)) : new Date();
        this.startedAt = props.startedAt ? (props.startedAt instanceof Date ? props.startedAt : new Date(props.startedAt)) : null;
        this.completedAt = props.completedAt ? (props.completedAt instanceof Date ? props.completedAt : new Date(props.completedAt)) : null;
        this.cancelledAt = props.cancelledAt ? (props.cancelledAt instanceof Date ? props.cancelledAt : new Date(props.cancelledAt)) : null;
        this.version = props.version ?? 1;
    }
    isDraft() {
        return this.status === ImportStatus.DRAFT;
    }
    isTerminal() {
        return [
            ImportStatus.COMPLETED,
            ImportStatus.COMPLETED_WITH_ERRORS,
            ImportStatus.FAILED,
            ImportStatus.CANCELLED
        ].includes(this.status);
    }
    isEditable() {
        return [
            ImportStatus.DRAFT,
            ImportStatus.UPLOADED,
            ImportStatus.PARSED,
            ImportStatus.MAPPING,
            ImportStatus.MAPPED,
            ImportStatus.VALIDATING,
            ImportStatus.VALIDATED,
            ImportStatus.VALIDATION_FAILED,
            ImportStatus.MATCHING,
            ImportStatus.REQUIRES_APPROVAL,
            ImportStatus.PENDING_APPROVAL,
            ImportStatus.APPROVED,
            ImportStatus.REJECTED,
            ImportStatus.FAILED
        ].includes(this.status);
    }
    toJSON() {
        return {
            id: this.id,
            organizationId: this.organizationId,
            sourceId: this.sourceId,
            targetModule: this.targetModule,
            targetEntity: this.targetEntity,
            name: this.name,
            status: this.status,
            sourceType: this.sourceType,
            fileName: this.fileName,
            fileSizeBytes: this.fileSizeBytes,
            fileMimeType: this.fileMimeType,
            fileChecksumSha256: this.fileChecksumSha256,
            fileMetadata: this.fileMetadata,
            importOptions: this.importOptions,
            totalRecords: this.totalRecords,
            validRecords: this.validRecords,
            invalidRecords: this.invalidRecords,
            warningRecords: this.warningRecords,
            processedRecords: this.processedRecords,
            failedRecords: this.failedRecords,
            skippedRecords: this.skippedRecords,
            requiresApproval: this.requiresApproval,
            createdBy: this.createdBy,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
            startedAt: this.startedAt ? this.startedAt.toISOString() : null,
            completedAt: this.completedAt ? this.completedAt.toISOString() : null,
            cancelledAt: this.cancelledAt ? this.cancelledAt.toISOString() : null,
            version: this.version
        };
    }
}
//# sourceMappingURL=data-import.entity.js.map