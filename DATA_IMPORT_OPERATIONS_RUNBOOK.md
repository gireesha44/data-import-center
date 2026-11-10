# DATA IMPORT CENTRE — OPERATIONS RUNBOOK

## Purpose
This runbook provides tier-1, tier-2, and platform engineers with step-by-step procedures for operating, monitoring, diagnosing, and recovering the Data Import Centre in staging and production environments.

---

## 1. Diagnostic Matrix & Common Incidents

### Scenario A: Import Job Stuck in Processing / Executing
**Symptoms:**
- Import status remains `EXECUTING`, `PARSING`, or `VALIDATING` for > 30 minutes.
- No new audit log entries or worker heartbeats.

**Root Causes:**
- Worker pod crash / unexpected SIGKILL during batch target writes.
- External database connection pool exhaustion or lock timeout.

**Resolution Procedure:**
1. Check import status and time elapsed:
   ```http
   GET /api/v1/imports/{importId}
   ```
2. Trigger the automated `RecoveryService` stalled-import sweeper:
   ```typescript
   await recoveryService.recoverStalledImports(1800); // 30-min threshold
   ```
3. Inspect structured logs with context filter:
   ```bash
   grep '"importId":"{importId}"' /var/log/data-import/app.log
   ```
4. If stalled during execution, inspect target write state and trigger retry:
   ```http
   POST /api/v1/imports/{importId}/retry
   ```

---

### Scenario B: Target Write Failure (High Error Count)
**Symptoms:**
- Import status transitions to `COMPLETED_WITH_ERRORS` or `FAILED`.
- Reconciliation summary reports missing target records or write errors.

**Root Causes:**
- Target API rate limit reached (HTTP 429).
- Database foreign key or unique constraint violation on target entity table.

**Resolution Procedure:**
1. Export the failed records CSV report with error taxonomy:
   ```http
   GET /api/v1/imports/{importId}/reports/failed-records
   ```
2. Review error classifications in the downloaded CSV (`error_code`, `error_message`, `is_retryable`).
3. If errors are transient network/timeout errors, trigger import retry:
   ```http
   POST /api/v1/imports/{importId}/retry
   ```
4. If errors are non-retryable constraint violations, instruct the user to fix source data or update schema rules.

---

### Scenario C: Reconciliation Mismatch Detected
**Symptoms:**
- Post-import status is `COMPLETED_WITH_ERRORS`.
- Reconciliation report shows `mismatchesCount > 0`.

**Root Causes:**
- Race condition on target record (external system mutated the target record during import execution).
- Async write dropped in downstream target queue.

**Resolution Procedure:**
1. Retrieve reconciliation discrepancy details:
   ```http
   GET /api/v1/imports/{importId}/reconciliation
   ```
2. Verify target record directly in database by `targetRecordId`.
3. Use the reconciliation audit trail to trace row index to target ID.

---

### Scenario D: High Memory / Large Import Slowness
**Symptoms:**
- High latency during parsing or validation of multi-gigabyte files.

**Root Causes:**
- Batch size too large for available worker memory.
- Complex regex transformers in mapping configuration.

**Resolution Procedure:**
1. Check Prometheus metrics:
   - `data_import_execution_duration_ms`
   - `data_import_memory_usage_bytes`
2. Adjust `DEFAULT_BATCH_SIZE` from 500 to 250 in environment variables.
3. Ensure file chunking is active during parsing.

---

## 2. Emergency Recovery & Disaster Procedures
1. **Rollback Staged Import**: If an import has not been executed yet, cancel immediately:
   ```http
   POST /api/v1/imports/{importId}/cancel
   ```
2. **Database Maintenance / Purge**: Run `CleanupService` to clean up expired temporary files and old staged rows:
   ```typescript
   await cleanupService.cleanupExpiredImports(90); // purge imports > 90 days old
   ```
