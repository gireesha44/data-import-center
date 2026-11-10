/**
 * Core Domain Types & Enums for Data Import Centre
 */
export declare enum ImportStatus {
    DRAFT = "DRAFT",
    UPLOADED = "UPLOADED",
    PARSING = "PARSING",
    PARSED = "PARSED",
    MAPPING = "MAPPING",
    MAPPED = "MAPPED",
    VALIDATING = "VALIDATING",
    VALIDATED = "VALIDATED",
    VALIDATION_FAILED = "VALIDATION_FAILED",
    /**
     * MATCHING: Transient state while duplicate detection/matching is being executed.
     * The import is read-only for configuration during this phase.
     * Transitions: VALIDATED → MATCHING → VALIDATED (scan complete, back to validated for review/approval)
     */
    MATCHING = "MATCHING",
    REQUIRES_APPROVAL = "REQUIRES_APPROVAL",
    PENDING_APPROVAL = "PENDING_APPROVAL",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    QUEUED = "QUEUED",
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED",
    RECONCILIATION_REQUIRED = "RECONCILIATION_REQUIRED"
}
export declare enum ImportSourceType {
    FILE_UPLOAD = "FILE_UPLOAD",
    REST_API = "REST_API",
    WEBHOOK = "WEBHOOK",
    INTERNAL_QUERY = "INTERNAL_QUERY",
    SCHEDULED_SYNC = "SCHEDULED_SYNC"
}
export declare enum ImportFileFormat {
    CSV = "CSV",
    XLSX = "XLSX",
    XLS = "XLS",
    JSON = "JSON",
    XML = "XML"
}
export declare enum ImportMode {
    INSERT_ONLY = "INSERT_ONLY",
    UPDATE_ONLY = "UPDATE_ONLY",
    UPSERT = "UPSERT",
    REPLACE = "REPLACE"
}
export declare enum RecordStatus {
    PENDING = "PENDING",
    VALID = "VALID",
    INVALID = "INVALID",
    WARNING = "WARNING",
    DUPLICATE = "DUPLICATE",
    SKIPPED = "SKIPPED",
    SKIPPED_DUPLICATE = "SKIPPED_DUPLICATE",
    REQUIRES_REVIEW = "REQUIRES_REVIEW",
    AUTO_CORRECTED = "AUTO_CORRECTED",
    READY_FOR_IMPORT = "READY_FOR_IMPORT",
    CREATED = "CREATED",
    UPDATED = "UPDATED",
    REJECTED = "REJECTED",
    FAILED = "FAILED"
}
export declare enum DuplicateStrategy {
    SKIP = "SKIP",
    UPDATE = "UPDATE",
    SEND_FOR_REVIEW = "SEND_FOR_REVIEW",
    MANUAL_REVIEW = "MANUAL_REVIEW"
}
export declare enum ErrorStrategy {
    CONTINUE_ON_ERROR = "CONTINUE_ON_ERROR",
    ALL_OR_NOTHING = "ALL_OR_NOTHING"
}
export declare enum ValidationSeverity {
    ERROR = "ERROR",
    WARNING = "WARNING",
    INFORMATION = "INFORMATION"
}
export declare enum ApprovalStatus {
    NOT_REQUIRED = "NOT_REQUIRED",
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    CANCELLED = "CANCELLED",
    INVALIDATED = "INVALIDATED"
}
export declare enum ExecutionStatus {
    INITIALIZED = "INITIALIZED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED"
}
export interface ImportOptions {
    batchSize?: number;
    skipHeaderRows?: number;
    delimiter?: string;
    encoding?: string;
    timezone?: string;
    dateFormat?: string;
    duplicateStrategy: DuplicateStrategy;
    errorStrategy: ErrorStrategy;
    notifyOnCompletion?: boolean;
    notificationEmails?: string[];
    customOptions?: Record<string, unknown>;
}
export interface ImportFilterQuery {
    page?: number;
    limit?: number;
    status?: ImportStatus;
    targetModule?: string;
    targetEntity?: string;
    sourceType?: ImportSourceType;
    createdBy?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}
export interface PaginatedResult<T> {
    data: T[];
    pagination: PaginationMeta;
}
export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
    meta?: Record<string, unknown>;
}
export interface ApiErrorDetail {
    field?: string;
    code: string;
    message: string;
    context?: Record<string, unknown>;
}
export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: ApiErrorDetail[];
    };
}
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
//# sourceMappingURL=import.types.d.ts.map