# Data Import Centre — Deployment & Operation Rollback Plan

This document defines the safe, non-destructive procedures for rolling back the Data Import Centre at both the infrastructure/deployment level and the runtime execution level.

---

## 1. Application Deployment Rollback

If a release containing the Data Import Centre must be rolled back to a previous application version:

### Step 1: Disable Ingestion Traffic (Graceful Drain)
- Route traffic away from `/api/v1/imports/*` using the API gateway or feature flag `FEATURE_DATA_IMPORT_ENABLED=false`.
- Allow any in-flight execution batches to finish (typically < 30 seconds).

### Step 2: Roll Back Application Code & Frontend
- Deploy previous application image/artifact.
- The previous version does not reference `/data-imports` UI or `/api/v1/imports/*` APIs.

### Step 3: Database Rollback (Zero Data Loss Strategy)
- **Recommendation**: Do NOT drop `data_import_*` tables during emergency rollback. Because all Data Import tables are isolated and foreign keys to host tables are read-only references (e.g. `organization_id`), leaving the tables intact has ZERO side effects on the host application and preserves all audit trails.
- **Full Schema Teardown (Optional / Staging Only)**:
  ```sql
  -- ONLY if completely decommissioning the module:
  DROP TABLE IF EXISTS data_import_audit_logs CASCADE;
  DROP TABLE IF EXISTS data_import_reconciliations CASCADE;
  DROP TABLE IF EXISTS data_import_executions CASCADE;
  DROP TABLE IF EXISTS data_import_approvals CASCADE;
  DROP TABLE IF EXISTS data_import_records CASCADE;
  DROP TABLE IF EXISTS data_import_mappings CASCADE;
  DROP TABLE IF EXISTS data_imports CASCADE;
  ```

---

## 2. Runtime Execution Rollback (Compensating Transactions)

When a specific import execution commits bad data to target entity tables, the module provides an automated rollback mechanism using the execution snapshot log.

### Rollback Process
1. Navigate to Import Execution Summary or invoke:
   `POST /api/v1/imports/:id/executions/:executionId/rollback`
2. **Execution Steps**:
   - **Created Records**: The rollback worker queries `data_import_records` where `execution_action = 'INSERT'` and deletes the newly created target IDs.
   - **Updated Records**: The rollback worker retrieves the `previous_state` JSON snapshot from `data_import_records` and restores the target record fields to their exact pre-import state.
   - **Reconciliation**: A post-rollback reconciliation run confirms variance is 0.
   - **Audit**: An `IMPORT_EXECUTION_ROLLED_BACK` audit log is permanently recorded with user ID and rationale.

---

## 3. Storage Cleanup Procedure

- Uploaded temporary files in `./storage/imports/<orgId>/<importId>/` or S3 bucket can be pruned after retention expiration (default: 90 days).
- In an emergency rollback, orphan temporary files can be purged with:
  ```bash
  # Standalone CLI cleanup
  node dist/scripts/cleanup-temp-storage.js --older-than-days=7
  ```
