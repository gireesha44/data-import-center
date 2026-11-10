# Data Import Centre — Phase 8: Reconciliation, Reporting, Error Recovery & Hardening

This document provides the comprehensive technical documentation for the **Post-Import Reconciliation, Final Reporting, Controlled Error Recovery, and Production Hardening Layer** (Phase 8).

---

## 1. Complete Import Lifecycle

With Phase 8 in place, the complete end-to-end import lifecycle is:

```text
FILE UPLOAD
     ↓
PARSE
     ↓
MAP
     ↓
TRANSFORM
     ↓
VALIDATE
     ↓
MATCH
     ↓
REVIEW
     ↓
APPROVE
     ↓
EXECUTE
     ↓
RECONCILE
     ↓
REPORT
     ↓
COMPLETE / COMPLETED_WITH_ERRORS
```

---

## 2. Post-Execution Reconciliation Engine

### Purpose
The Reconciliation Engine (`ReconciliationService`) inspects staged records and compares the **intended execution actions** against the **actual target write outcomes**.

### Intended vs Actual Comparison Matrix

| Intended Action | Permitted Actual Status | Outcome |
|---|---|---|
| `CREATE` | `CREATED` | Fully Reconciled |
| `CREATE` | `FAILED` | Failed Attempt (Reconciled as Failure) |
| `CREATE` | `SKIPPED` / `REJECTED` / other | **Mismatch** (`INTENT_RESULT_MISMATCH`) |
| `UPDATE` | `UPDATED` | Fully Reconciled |
| `UPDATE` | `FAILED` | Failed Attempt (Reconciled as Failure) |
| `UPDATE` | `CREATED` / `SKIPPED` / other | **Mismatch** (`INTENT_RESULT_MISMATCH`) |
| `SKIP` | `SKIPPED` / `VALID` | Fully Reconciled |
| `BLOCKED` | `REJECTED` / `INVALID` | Fully Reconciled |

### Reconciliation Status Determination
- **`FULLY_RECONCILED`**: All intended actions match actual outcomes; zero failures, zero mismatches. State transitions to `COMPLETED`.
- **`PARTIALLY_RECONCILED`**: Valid executions reconciled, but some records suffered transient/persistent failures (`FAILED`). State transitions to `COMPLETED_WITH_ERRORS`.
- **`MISMATCHED`**: Divergence detected (e.g. record planned for CREATE was marked SKIPPED or had target ID divergence). State transitions to `RECONCILIATION_REQUIRED`.
- **`RECONCILIATION_FAILED`**: Execution plan could not be verified.

---

## 3. Comprehensive Final Reporting & Drilldown

The `ReportingService` aggregates multi-phase statistics into a unified 5-tier summary:

```text
Final Import Report
├── Import Information (ID, entity, version, duration, timing, actor)
├── Processing Summary (Total, parsed, valid, invalid, warnings)
├── Matching Summary (New, existing, duplicates-in-file, conflicts, unresolved)
├── Execution Summary (Attempted, created, updated, skipped, blocked, failed)
├── Reconciliation Summary (Status, isFullyReconciled, mismatch counts)
├── Performance Benchmarks (Phase durations)
└── Failed Records Summary (Retryable vs Non-retryable counts, top error codes)
```

---

## 4. Security Hardening & Formula Injection Defense

### CSV / Excel Formula Injection Defense
When exporting reports or failed records as CSV/XLSX, cell values starting with formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically escaped with a leading single quote (`'`):

```typescript
if (/^[=+\-@\t\r]/.test(str)) {
  str = `'${str}`;
}
```
This guarantees that malicious payloads uploaded by untrusted users (e.g. `=cmd|' /C calc'!A0` or `@SUM(1+1)`) cannot execute when opened in Microsoft Excel or Google Sheets.

### Tenancy & Object-Level RBAC
Every endpoint strictly validates:
1. Multi-tenant boundary: `context.organizationId` scoping on every database and storage query.
2. RBAC permissions: `DATA_IMPORT_VIEW`, `DATA_IMPORT_APPROVE`, `DATA_IMPORT_EXECUTE`.
3. Separation of duties: Creator cannot approve their own job.

---

## 5. Controlled Error Recovery & Retry Engine

### Error Categorization Taxonomy
- `VALIDATION_ERROR`: Schema constraints, missing required fields.
- `MAPPING_ERROR`: Incompatible column types.
- `CONSTRAINT_ERROR`: Unique key violation in target system.
- `TRANSIENT_ERROR`: Database timeout, connection reset, worker restart.
- `CONFLICT_ERROR`: Concurrency lock collision.

### Retryability Classification
- **`RETRYABLE`**: `TRANSIENT_ERROR`, `CONFLICT_ERROR`.
- **`NON_RETRYABLE`**: `VALIDATION_ERROR`, `MAPPING_ERROR`, `CONSTRAINT_ERROR`, `AUTHORIZATION_ERROR`.

### Retry Safety Rules
1. Retrying produces a discrete retry attempt while preserving historical execution records.
2. Strict limit enforcement: Maximum 3 retry attempts per record.
3. Post-retry re-reconciliation automatically re-evaluates the final import state.

---

## 6. Orphan Detection & Recovery

The `RecoveryService` runs background sweeps for jobs stuck in `PROCESSING` or `QUEUED` without activity beyond a configured threshold (15 minutes). It safely recovers the state to `FAILED` with audit logging, preventing permanent lockouts.

---

## 7. Metrics & Observability

`MetricsService` exposes structured counters and histograms at `/metrics`:
- `imports_started_total`
- `imports_completed_total`
- `records_created_total`, `records_updated_total`, `records_failed_total`
- `reconciliation_duration_ms`
- `retry_duration_ms`

---

## 8. REST API Reference

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `POST` | `/api/v1/data-imports/:id/reconcile` | `DATA_IMPORT_VIEW` | Triggers post-execution reconciliation |
| `GET` | `/api/v1/data-imports/:id/report` | `DATA_IMPORT_VIEW` | Returns final reconciled 5-tier report JSON |
| `GET` | `/api/v1/data-imports/:id/report/export` | `DATA_IMPORT_VIEW` | Download report as sanitized CSV/JSON |
| `GET` | `/api/v1/data-imports/:id/failed-records` | `DATA_IMPORT_VIEW` | Paginated failed records with retryability |
| `GET` | `/api/v1/data-imports/:id/failed-records/export` | `DATA_IMPORT_VIEW` | Download failed records CSV with formula protection |
| `POST` | `/api/v1/data-imports/:id/retry` | `DATA_IMPORT_EXECUTE` | Execute controlled retry of eligible failed records |
| `GET` | `/health` | Public | System health and readiness probe |
| `GET` | `/metrics` | Public / Operator | Operational performance metrics summary |
