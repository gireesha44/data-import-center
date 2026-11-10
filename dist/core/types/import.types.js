/**
 * Core Domain Types & Enums for Data Import Centre
 */
export var ImportStatus;
(function (ImportStatus) {
    ImportStatus["DRAFT"] = "DRAFT";
    ImportStatus["UPLOADED"] = "UPLOADED";
    ImportStatus["PARSING"] = "PARSING";
    ImportStatus["PARSED"] = "PARSED";
    ImportStatus["MAPPING"] = "MAPPING";
    ImportStatus["MAPPED"] = "MAPPED";
    ImportStatus["VALIDATING"] = "VALIDATING";
    ImportStatus["VALIDATED"] = "VALIDATED";
    ImportStatus["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    /**
     * MATCHING: Transient state while duplicate detection/matching is being executed.
     * The import is read-only for configuration during this phase.
     * Transitions: VALIDATED → MATCHING → VALIDATED (scan complete, back to validated for review/approval)
     */
    ImportStatus["MATCHING"] = "MATCHING";
    ImportStatus["REQUIRES_APPROVAL"] = "REQUIRES_APPROVAL";
    ImportStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
    ImportStatus["APPROVED"] = "APPROVED";
    ImportStatus["REJECTED"] = "REJECTED";
    ImportStatus["QUEUED"] = "QUEUED";
    ImportStatus["PROCESSING"] = "PROCESSING";
    ImportStatus["COMPLETED"] = "COMPLETED";
    ImportStatus["COMPLETED_WITH_ERRORS"] = "COMPLETED_WITH_ERRORS";
    ImportStatus["FAILED"] = "FAILED";
    ImportStatus["CANCELLED"] = "CANCELLED";
    ImportStatus["RECONCILIATION_REQUIRED"] = "RECONCILIATION_REQUIRED";
})(ImportStatus || (ImportStatus = {}));
export var ImportSourceType;
(function (ImportSourceType) {
    ImportSourceType["FILE_UPLOAD"] = "FILE_UPLOAD";
    ImportSourceType["REST_API"] = "REST_API";
    ImportSourceType["WEBHOOK"] = "WEBHOOK";
    ImportSourceType["INTERNAL_QUERY"] = "INTERNAL_QUERY";
    ImportSourceType["SCHEDULED_SYNC"] = "SCHEDULED_SYNC";
})(ImportSourceType || (ImportSourceType = {}));
export var ImportFileFormat;
(function (ImportFileFormat) {
    ImportFileFormat["CSV"] = "CSV";
    ImportFileFormat["XLSX"] = "XLSX";
    ImportFileFormat["XLS"] = "XLS";
    ImportFileFormat["JSON"] = "JSON";
    ImportFileFormat["XML"] = "XML";
})(ImportFileFormat || (ImportFileFormat = {}));
export var ImportMode;
(function (ImportMode) {
    ImportMode["INSERT_ONLY"] = "INSERT_ONLY";
    ImportMode["UPDATE_ONLY"] = "UPDATE_ONLY";
    ImportMode["UPSERT"] = "UPSERT";
    ImportMode["REPLACE"] = "REPLACE";
})(ImportMode || (ImportMode = {}));
export var RecordStatus;
(function (RecordStatus) {
    RecordStatus["PENDING"] = "PENDING";
    RecordStatus["VALID"] = "VALID";
    RecordStatus["INVALID"] = "INVALID";
    RecordStatus["WARNING"] = "WARNING";
    RecordStatus["DUPLICATE"] = "DUPLICATE";
    RecordStatus["SKIPPED"] = "SKIPPED";
    RecordStatus["SKIPPED_DUPLICATE"] = "SKIPPED_DUPLICATE";
    RecordStatus["REQUIRES_REVIEW"] = "REQUIRES_REVIEW";
    RecordStatus["AUTO_CORRECTED"] = "AUTO_CORRECTED";
    RecordStatus["READY_FOR_IMPORT"] = "READY_FOR_IMPORT";
    RecordStatus["CREATED"] = "CREATED";
    RecordStatus["UPDATED"] = "UPDATED";
    RecordStatus["REJECTED"] = "REJECTED";
    RecordStatus["FAILED"] = "FAILED";
})(RecordStatus || (RecordStatus = {}));
export var DuplicateStrategy;
(function (DuplicateStrategy) {
    DuplicateStrategy["SKIP"] = "SKIP";
    DuplicateStrategy["UPDATE"] = "UPDATE";
    DuplicateStrategy["SEND_FOR_REVIEW"] = "SEND_FOR_REVIEW";
    DuplicateStrategy["MANUAL_REVIEW"] = "MANUAL_REVIEW";
})(DuplicateStrategy || (DuplicateStrategy = {}));
export var ErrorStrategy;
(function (ErrorStrategy) {
    ErrorStrategy["CONTINUE_ON_ERROR"] = "CONTINUE_ON_ERROR";
    ErrorStrategy["ALL_OR_NOTHING"] = "ALL_OR_NOTHING";
})(ErrorStrategy || (ErrorStrategy = {}));
export var ValidationSeverity;
(function (ValidationSeverity) {
    ValidationSeverity["ERROR"] = "ERROR";
    ValidationSeverity["WARNING"] = "WARNING";
    ValidationSeverity["INFORMATION"] = "INFORMATION";
})(ValidationSeverity || (ValidationSeverity = {}));
export var ApprovalStatus;
(function (ApprovalStatus) {
    ApprovalStatus["NOT_REQUIRED"] = "NOT_REQUIRED";
    ApprovalStatus["PENDING"] = "PENDING";
    ApprovalStatus["APPROVED"] = "APPROVED";
    ApprovalStatus["REJECTED"] = "REJECTED";
    ApprovalStatus["CANCELLED"] = "CANCELLED";
    ApprovalStatus["INVALIDATED"] = "INVALIDATED";
})(ApprovalStatus || (ApprovalStatus = {}));
export var ExecutionStatus;
(function (ExecutionStatus) {
    ExecutionStatus["INITIALIZED"] = "INITIALIZED";
    ExecutionStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ExecutionStatus["COMPLETED"] = "COMPLETED";
    ExecutionStatus["FAILED"] = "FAILED";
    ExecutionStatus["CANCELLED"] = "CANCELLED";
})(ExecutionStatus || (ExecutionStatus = {}));
//# sourceMappingURL=import.types.js.map