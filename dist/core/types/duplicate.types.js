/**
 * Duplicate Detection and Record Matching Domain Types
 */
export var MatchClassification;
(function (MatchClassification) {
    MatchClassification["NEW"] = "NEW";
    MatchClassification["EXISTING"] = "EXISTING";
    MatchClassification["DUPLICATE_IN_FILE"] = "DUPLICATE_IN_FILE";
    MatchClassification["DUPLICATE_IN_TARGET"] = "DUPLICATE_IN_TARGET";
    MatchClassification["MULTIPLE_MATCH"] = "MULTIPLE_MATCH";
    MatchClassification["CONFLICT"] = "CONFLICT";
    MatchClassification["UNRESOLVED"] = "UNRESOLVED";
    MatchClassification["INVALID"] = "INVALID";
})(MatchClassification || (MatchClassification = {}));
export var MatchConfidence;
(function (MatchConfidence) {
    MatchConfidence["EXACT"] = "EXACT";
    MatchConfidence["HIGH"] = "HIGH";
    MatchConfidence["MEDIUM"] = "MEDIUM";
    MatchConfidence["LOW"] = "LOW";
    MatchConfidence["NONE"] = "NONE";
})(MatchConfidence || (MatchConfidence = {}));
export var ExecutionIntentAction;
(function (ExecutionIntentAction) {
    ExecutionIntentAction["CREATE"] = "CREATE";
    ExecutionIntentAction["UPDATE"] = "UPDATE";
    ExecutionIntentAction["SKIP"] = "SKIP";
    ExecutionIntentAction["REJECT"] = "REJECT";
    ExecutionIntentAction["REVIEW"] = "REVIEW";
    ExecutionIntentAction["BLOCKED"] = "BLOCKED";
})(ExecutionIntentAction || (ExecutionIntentAction = {}));
//# sourceMappingURL=duplicate.types.js.map