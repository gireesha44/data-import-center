# Data Import Centre — Phase 2 Foundation Architecture & Core Domain Implementation

This document details the foundation layer implemented during **Phase 2** of the **Data Import Centre**. It provides the reference documentation for domain models, database migrations, state machine rules, security context & permissions, repository access, audit logging, error hierarchy, configuration management, schema registry, and foundation APIs.

---

## 1. Implemented Architecture

The foundation establishes a multi-layered, decoupled domain architecture:

```
[ HTTP Client / Frontend ]
          │
          ▼
[ Express Router & Middlewares ]
  ├── Security Context Middleware (Extracts Tenant & Actor Context)
  ├── RBAC Permission Guards (requirePermission)
  └── Global Error Middleware (Sanitized API Error Responses)
          │
          ▼
[ ImportController ] (HTTP Request Validation via Zod Schemas)
          │
          ▼
[ ImportService ] (Domain Logic Coordinator)
  ├── Enforces ImportStateMachine Transition Guards
  ├── Validates Target Entity against EntitySchemaRegistry
  ├── Delegates to IDataImportRepository (Tenant Scoped)
  └── Triggers Immutable Event Recording via IAuditService
          │
          ▼
[ Persistence & Core Models ]
  ├── PostgreSQL Schema DDL (001_create_data_import_schema.sql)
  ├── Normalized Tables & JSONB Staging Models
  └── InMemoryDataImportRepository (with Compound Tenant Indexing)
```

---

## 2. Database Models & Schema Migration

The SQL migration is defined in [`src/database/migrations/001_create_data_import_schema.sql`](file:///c:/Users/laxmi/OneDrive/Desktop/data-import-center/src/database/migrations/001_create_data_import_schema.sql).

### Implemented Relational Entities:
1. `data_imports`: Master entity tracking import lifecycle, file metadata, totals (`total_records`, `valid_records`, `invalid_records`, `processed_records`), timestamps, and optimistic locking (`version`).
2. `data_import_sources`: Configured ingestion endpoints and file storage profiles.
3. `data_import_mappings`: Column associations, custom transformations, and default values stored in structured `JSONB`.
4. `data_import_templates`: Versioned reusable mapping definitions scoped by tenant and target entity.
5. `data_import_records`: High-throughput staging table containing immutable `raw_data` and staged `transformed_data` with cell error arrays (`validation_errors`).
6. `data_import_approvals`: Multi-condition approval decisions with cryptographic SHA256 snapshot hashes (`snapshot_hash`).
7. `data_import_executions`: Execution batch runs, duration metrics, worker node leases, and error summaries.
8. `data_import_audit_logs`: Append-only, chronological event trail with actor context and state diffs.

---

## 3. Enumerations & Domain Types

Defined in [`src/core/types/import.types.ts`](file:///c:/Users/laxmi/OneDrive/Desktop/data-import-center/src/core/types/import.types.ts):

- `ImportStatus`: `DRAFT`, `UPLOADED`, `PARSING`, `PARSED`, `MAPPING`, `MAPPED`, `VALIDATING`, `VALIDATED`, `VALIDATION_FAILED`, `REQUIRES_APPROVAL`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `QUEUED`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED`, `CANCELLED`, `RECONCILIATION_REQUIRED`.
- `ImportSourceType`: `FILE_UPLOAD`, `REST_API`, `WEBHOOK`, `INTERNAL_QUERY`, `SCHEDULED_SYNC`.
- `ImportFileFormat`: `CSV`, `XLSX`, `XLS`, `JSON`, `XML`.
- `ImportMode`: `INSERT_ONLY`, `UPDATE_ONLY`, `UPSERT`, `REPLACE`.
- `RecordStatus`: `PENDING`, `VALID`, `INVALID`, `WARNING`, `DUPLICATE`, `SKIPPED`, `CREATED`, `UPDATED`, `REJECTED`, `FAILED`.
- `DuplicateStrategy`: `SKIP`, `UPDATE`, `REJECT`, `MANUAL_REVIEW`.
- `ErrorStrategy`: `CONTINUE_ON_ERROR`, `ALL_OR_NOTHING`.
- `ValidationSeverity`: `ERROR`, `WARNING`, `INFORMATION`.
- `ApprovalStatus`: `NOT_REQUIRED`, `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `INVALIDATED`.
- `ExecutionStatus`: `INITIALIZED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `CANCELLED`.

---

## 4. Import State Machine

Implemented in [`src/domain/state-machine/import-state-machine.ts`](file:///c:/Users/laxmi/OneDrive/Desktop/data-import-center/src/domain/state-machine/import-state-machine.ts).

### Key Rules:
- Enforces strict transition maps (e.g. `DRAFT -> UPLOADED -> PARSING -> PARSED -> MAPPING -> MAPPED -> VALIDATING -> VALIDATED`).
- Direct jumps across unreached stages (e.g. `DRAFT -> COMPLETED`) are rejected with `InvalidStateTransitionError` (HTTP 422).
- Terminal states (`COMPLETED`, `CANCELLED`) reject further state transitions.
- Cancelling is permitted only on cancellable active states (`isCancellable(status)`).
- Automatically manages lifecycle timestamps (`startedAt`, `completedAt`, `cancelledAt`) and increments entity `version`.

---

## 5. Security, Authorization & Tenant Isolation

- **Centralized Permissions** ([`src/core/types/permissions.types.ts`](file:///c:/Users/laxmi/OneDrive/Desktop/data-import-center/src/core/types/permissions.types.ts)):
  - `DATA_IMPORT_VIEW` (`data_import:view`)
  - `DATA_IMPORT_CREATE` (`data_import:create`)
  - `DATA_IMPORT_UPLOAD` (`data_import:upload`)
  - `DATA_IMPORT_VALIDATE` (`data_import:validate`)
  - `DATA_IMPORT_EXECUTE` (`data_import:execute`)
  - `DATA_IMPORT_APPROVE` (`data_import:approve`)
  - `DATA_IMPORT_CANCEL` (`data_import:cancel`)
  - `DATA_IMPORT_RETRY` (`data_import:retry`)
  - `DATA_IMPORT_VIEW_SENSITIVE` (`data_import:view_sensitive`)
  - `DATA_IMPORT_MANAGE_SOURCES` (`data_import:manage_sources`)
  - `DATA_IMPORT_MANAGE_TEMPLATES` (`data_import:manage_templates`)
  - `DATA_IMPORT_VIEW_AUDIT` (`data_import:view_audit`)
- **Tenant Scoping**: All database repository queries enforce `organization_id` filters. Cross-tenant access is rejected with `NotFoundError` (HTTP 404) or `ForbiddenError` (HTTP 403), preventing data leakage.
- **RBAC Guard Middleware**: `requirePermission(permission)` intercepts unauthorized requests before reaching controllers.

---

## 6. Standardized Error System & API Response Format

Implemented in [`src/core/errors/import.errors.ts`](file:///c:/Users/laxmi/OneDrive/Desktop/data-import-center/src/core/errors/import.errors.ts) and [`src/api/middleware/error.middleware.ts`](file:///c:/Users/laxmi/OneDrive/Desktop/data-import-center/src/api/middleware/error.middleware.ts).

### Error Response Schema:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload or parameters",
    "details": [
      {
        "field": "name",
        "code": "too_small",
        "message": "Name is required"
      }
    ]
  }
}
```

### Success Response Schema:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Contacts Import",
    "status": "DRAFT",
    "version": 1
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

---

## 7. Audit Logging Foundation

Implemented in [`src/infrastructure/services/audit.service.ts`](file:///c:/Users/laxmi/OneDrive/Desktop/data-import-center/src/infrastructure/services/audit.service.ts).
- Automatically records immutable events for:
  - `IMPORT_CREATED`
  - `IMPORT_UPDATED`
  - `IMPORT_CANCELLED`
  - State machine transitions
- Captures: `organizationId`, `importId`, `actorUserId`, `action`, `fromState`, `toState`, `details`, and ISO timestamps.

---

## 8. Entity Schema Registry Foundation

Implemented in [`src/core/registry/entity-schema.registry.ts`](file:///c:/Users/laxmi/OneDrive/Desktop/data-import-center/src/core/registry/entity-schema.registry.ts).
- Serves as the single source of truth for target entities.
- Pre-loaded with baseline standard entities (`contacts`, `products`).
- Provides schema validation, field discovery, and required field discovery.

---

## 9. Foundation APIs Implemented

| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `/api/v1/data-imports` | `POST` | `data_import:create` | Creates a new import job in `DRAFT` state |
| `/api/v1/data-imports` | `GET` | `data_import:view` | Returns a paginated, sorted, and filtered list of imports for tenant |
| `/api/v1/data-imports/:id` | `GET` | `data_import:view` | Retrieves import job metadata and status |
| `/api/v1/data-imports/:id` | `PATCH` | `data_import:create` | Updates draft parameters (name, entity, options) |
| `/api/v1/data-imports/:id/cancel` | `POST` | `data_import:cancel` | Cancels an active import job using the state machine |
| `/health` | `GET` | *Public* | Health check endpoint |

---

## 10. Verification & Test Suite Summary

- **Total Test Suites**: 9 suites
- **Total Tests Executed**: 46 automated tests
- **Pass Rate**: 100% (46 passed, 0 failed, 0 skipped)
- **Execution Time**: ~15.7 seconds
- **Test Categories**:
  - `state-machine.test.ts`: Progression, invalid transitions, cancellation, timestamps, allowed transitions.
  - `permissions.test.ts`: RBAC evaluation, composite permissions, invalid context handling.
  - `entity-registry.test.ts`: Case-insensitive lookups, listing, required fields, registration validation.
  - `config-logger.test.ts`: Operational defaults, configuration overrides, structured logging with PII redaction.
  - `errors-validation.test.ts`: Error class status codes, Zod schema validation, pagination query parsing.
  - `import-service.test.ts`: Service creation, schema checks, draft updates, cancellations, terminal guards.
  - `import-api.test.ts`: HTTP integration tests for all foundation endpoints, bad request handling, forbidden access.
  - `tenant-isolation.test.ts`: Cross-tenant read, update, cancel, and list isolation tests.
  - `audit-trail.test.ts`: Immutable audit event persistence across the import lifecycle.

---

## 11. Known Limitations & Phase 3 Readiness

### Known Limitations:
- File upload multipart chunking, streaming file parsers (CSV/Excel/JSON/XML), column mapping studio, deterministic transformations, duplicate detection, and execution worker processing are scheduled for subsequent phases as per the project roadmap.
- In the standalone development environment, security context is passed via API gateway headers (`x-organization-id`, `x-user-id`, `x-permissions`). In production, this integrates with the enterprise identity provider.

### Phase 3 Readiness:
The foundation, domain models, state machine, repository layer, registry, and audit system are fully verified and ready for:
**PHASE 3 — FILE INGESTION & PARSING**.
