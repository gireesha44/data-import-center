# Data Import Centre — Deployment Impact Assessment

This document outlines the operational, infrastructure, schema, and architectural impact of deploying the Data Import Centre into a production host application.

---

## 1. Summary of Changes

| Domain | Impact Level | Description |
| :--- | :--- | :--- |
| **Database Schema** | Low | Adds 7 isolated tables prefixed with `data_import_*`. Zero modifications to existing host tables. |
| **Backend Endpoints** | Low | Adds `/api/v1/imports/*` route subtree. No overrides of existing API routes. |
| **Worker / Queue** | Low (Optional) | Optional background job worker for asynchronous large imports. |
| **Environment Config** | Minimal | 6 new optional environment variables with sensible defaults. |
| **Storage Subsystem** | Low | Requires storage location for uploaded files and report exports. |
| **Frontend Bundle** | Low (~120KB gzip) | Adds `/data-imports` route and modular UI components. |

---

## 2. Database Changes (Migrations)

All migrations are forward-only and additive. No existing tables are altered, dropped, or renamed.

### Added Tables:
1. `data_imports`: Primary import job tracking table.
2. `data_import_mappings`: Saved mapping configuration templates and rules.
3. `data_import_records`: Staged raw and transformed records with validation states.
4. `data_import_approvals`: Approval requests, review notes, and signatures.
5. `data_import_executions`: Execution run metrics, chunk states, and transaction tracking.
6. `data_import_reconciliations`: Post-execution reconciliation variance metrics.
7. `data_import_audit_logs`: Append-only compliance audit trail.

### Indexes Added:
- `idx_data_imports_org_status`: `(organization_id, status)`
- `idx_data_import_records_import_status`: `(import_id, status)`
- `idx_data_import_audit_org_timestamp`: `(organization_id, timestamp DESC)`

---

## 3. Environment Variables Configuration

The following variables can be added to the host application's `.env` or secret manager:

```bash
# Data Import Centre Configuration
DATA_IMPORT_MAX_FILE_SIZE_BYTES=104857600   # Default: 100MB
DATA_IMPORT_BATCH_SIZE=500                 # Default: 500 rows per transaction chunk
DATA_IMPORT_STORAGE_DRIVER=local           # Options: 'local', 's3', 'gcs'
DATA_IMPORT_STORAGE_PATH=./storage/imports # Default local storage root
DATA_IMPORT_QUEUE_ENABLED=false            # Set true for BullMQ async processing
DATA_IMPORT_RETENTION_DAYS=90              # Days before staging records are archived
```

---

## 4. API & Route Surface

The module exposes the following endpoints under the `/api/v1/imports` namespace:

```text
POST   /api/v1/imports/upload           -> Upload and stage dataset
GET    /api/v1/imports                  -> List imports for organization
GET    /api/v1/imports/:id              -> Get import details & stats
POST   /api/v1/imports/:id/mapping      -> Save & apply column mappings
POST   /api/v1/imports/:id/validate     -> Execute transformation & validation
GET    /api/v1/imports/:id/records      -> Query staged records (paginated/filtered)
POST   /api/v1/imports/:id/approve      -> Submit/grant approval
POST   /api/v1/imports/:id/execute      -> Execute transactional write to target
POST   /api/v1/imports/:id/retry        -> Retry failed record chunks
GET    /api/v1/imports/:id/reconcile    -> Get reconciliation variance report
GET    /api/v1/imports/:id/export       -> Export error or reconciliation CSV
GET    /api/v1/imports/:id/audit        -> Query audit trail
```

---

## 5. Security & Isolation Impact

- **Tenant Isolation**: 100% of SQL queries enforce `WHERE organization_id = :orgId`.
- **RBAC**: Enforces host permissions or standard roles before every state change.
- **Data Protection**: File parsing runs in-memory with strict stream bounds to prevent ZIP bomb / CSV injection attacks.
- **Rollback Safety**: Full snapshotting and execution rollback logging ensure target entities can be restored in event of failure.
