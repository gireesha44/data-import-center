# DATA IMPORT CENTRE — FINAL INTEGRATION AUDIT

This document audits all dependencies between the Data Import Centre module and external host application services to ensure safe, collision-free integration into the production host codebase.

---

## 1. External Dependency & Integration Point Matrix

| Dependency Area | Current Standalone Assumption | Expected Host Implementation | Integration Point | Potential Conflict | Required Action | Risk Level |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Authentication** | Request headers `x-user-id`, `x-organization-id`, `x-user-roles`, `x-user-permissions` | Express / Passport / JWT / Session middleware populating `req.user` / `req.session` | `src/api/middleware/auth.middleware.ts` (`securityContextMiddleware`) | Host middleware sets `req.user` or session tokens instead of headers | Bridge `securityContextMiddleware` to read from host `req.user` & `req.tenant` | **MEDIUM** |
| **Database Connection & ORM** | PostgreSQL connection via Knex / Kysely / pg / Prisma with schema `001_create_data_import_schema.sql` | Host PostgreSQL database with existing migrations runner (Prisma, TypeORM, Knex, Flyway) | `src/infrastructure/database/` & Repositories | Table name collisions, migration numbering conflicts | Prefix table names (`data_import_*`), run migration through host migration pipeline | **LOW** |
| **User & Tenant Model** | `organization_id` (`string`/`UUID`), `user_id` (`string`/`UUID`) | Host `users` and `organizations` / `tenants` tables | Repository tenant scoping and foreign key constraints | Host uses `tenant_id` or integer IDs (`int8`) instead of string/UUID | Ensure `organizationId` and `userId` types match host column definitions | **MEDIUM** |
| **RBAC & Authorization** | Specific permissions (`DATA_IMPORT_CREATE`, `DATA_IMPORT_APPROVE`, etc.) | Host RBAC permission table or policy engine (CASL / Casbin / custom) | `src/api/middleware/auth.middleware.ts` (`requirePermission`) | Host uses role-based flags (e.g. `is_admin`) or different permission names | Provide `DATA_IMPORT_PERMISSION_MAPPING.md` adapter mapping host roles to tokens | **LOW** |
| **File Storage Provider** | `IFileStorageService` with local disk staging (`./temp/imports`) | AWS S3, Cloudflare R2, Google Cloud Storage, or Azure Blob | `src/infrastructure/storage/file-storage.service.ts` | Host stores files in S3 buckets with IAM credentials | Implement S3 adapter implementing `IFileStorageService` | **LOW** |
| **Queue & Worker Engine** | Process-based async execution / in-process execution engine | BullMQ / Redis, RabbitMQ, SQS, or Kafka | `src/domain/services/execution.service.ts` | Host uses existing Redis cluster with BullMQ worker pool | Wrap `ExecutionService.executeImport` in a standard host BullMQ worker job | **MEDIUM** |
| **Structured Logging** | `StructuredLogger` (JSON stdout logger with secret masking) | Pino, Winston, Datadog, or Bunyan | `src/core/logging/structured-logger.ts` | Host uses centralized logging agent with custom log format | Connect `StructuredLogger` output stream to host logger instance | **LOW** |
| **Audit Trail** | `data_import_audit_logs` table via `AuditService` | Centralized corporate audit trail table or event bus | `src/infrastructure/services/audit.service.ts` | Redundant audit records if host logs all HTTP mutations | Maintain domain import audit table or forward events to host audit bus | **LOW** |
| **Notifications** | Optional logging / webhook callbacks | Host SendGrid / SES / Twilio / Slack notification service | `src/domain/services/approval.service.ts`, `execution.service.ts` | Notification spam or missing email templates | Connect approval request and completion hooks to host notification service | **LOW** |
| **Target Entities (CRM/ERP)**| `contacts`, `products`, `invoices` schemas registered in `EntitySchemaRegistry` | Real Prisma / TypeORM models in host application database | `ITargetMatchProvider` & `EntitySchemaRegistry` | Column name differences (e.g. `firstName` vs `first_name`) | Map exact schema fields in `EntitySchemaRegistry` to match host entity models | **MEDIUM** |
| **API Conventions** | `/api/v1/data-imports` with standard JSON `{ success, data, error }` | Host API routing conventions and error response envelopes | `src/api/routes/import.routes.ts`, `error.middleware.ts` | Host wraps responses in different envelope (e.g. `{ result, status }`) | Align error handler middleware with host global error response standard | **LOW** |

---

## 2. Integration Action Summary
1. **Zero Breaking Changes**: All Data Import tables are self-contained and prefixed with `data_import_*`, preventing naming collisions with existing host tables.
2. **Pluggable Security**: The `securityContextMiddleware` is isolated in one file, allowing seamless adaptation to host JWT / session providers.
3. **Pluggable Target Mutations**: The `ITargetMatchProvider` interface enables the host application to use direct database transactions or host domain service calls for writing created/updated records.
