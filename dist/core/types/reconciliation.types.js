/**
 * Post-Import Reconciliation, Reporting, Error Recovery & Hardening Types
 */
export var ReconciliationStatus;
(function (ReconciliationStatus) {
    ReconciliationStatus["FULLY_RECONCILED"] = "FULLY_RECONCILED";
    ReconciliationStatus["PARTIALLY_RECONCILED"] = "PARTIALLY_RECONCILED";
    ReconciliationStatus["MISMATCHED"] = "MISMATCHED";
    ReconciliationStatus["RECONCILIATION_FAILED"] = "RECONCILIATION_FAILED";
})(ReconciliationStatus || (ReconciliationStatus = {}));
export var ReconciliationMismatchType;
(function (ReconciliationMismatchType) {
    ReconciliationMismatchType["INTENT_RESULT_MISMATCH"] = "INTENT_RESULT_MISMATCH";
    ReconciliationMismatchType["TARGET_ID_MISMATCH"] = "TARGET_ID_MISMATCH";
    ReconciliationMismatchType["UNEXECUTED_PLANNED_RECORD"] = "UNEXECUTED_PLANNED_RECORD";
    ReconciliationMismatchType["UNEXPECTED_EXECUTION_RESULT"] = "UNEXPECTED_EXECUTION_RESULT";
})(ReconciliationMismatchType || (ReconciliationMismatchType = {}));
//# sourceMappingURL=reconciliation.types.js.map