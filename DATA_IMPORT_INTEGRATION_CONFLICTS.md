# Data Import Centre — Integration Conflicts & Resolutions

This document catalogs potential architectural and implementation divergences between the standalone Data Import Centre and the host application, along with severity classifications and standardized resolution strategies.

---

## Conflict Inventory

### Conflict 1: Authentication Context Format
- **Severity**: MEDIUM
- **Affected Component**: `src/api/middleware/auth.middleware.ts`
- **Current Implementation**: Reads `x-organization-id`, `x-user-id`, `x-user-roles`, `x-user-permissions` headers or standard Express `req.user`.
- **Host Application Implementation**: May use passport session, encrypted cookie, or signed JWT bearer tokens.
- **Recommended Resolution**: Replace or wrap `securityContextMiddleware` with a single 15-line adapter function that parses the host's JWT/session object into `ISecurityContext`.

### Conflict 2: Target Entity Write Mechanism (Direct DB vs Domain Service)
- **Severity**: MEDIUM
- **Affected Component**: `src/domain/execution/execution.engine.ts`
- **Current Implementation**: Supports both direct table writes and `ITargetMatchProvider` service delegations.
- **Host Application Implementation**: Host may have complex ORM hooks (Prisma, TypeORM, Mongoose, ActiveRecord) with custom side effects (audit triggers, cache invalidation, webhooks).
- **Recommended Resolution**: Implement `ITargetMatchProvider` using the host's existing domain entity services rather than raw SQL `INSERT`/`UPDATE` queries.

### Conflict 3: Background Worker Queue Driver
- **Severity**: LOW
- **Affected Component**: `src/infrastructure/queue/`
- **Current Implementation**: In-process synchronous chunk executor with pluggable `IQueueAdapter`.
- **Host Application Implementation**: Host may utilize BullMQ, Celery, SQS, or RabbitMQ.
- **Recommended Resolution**: Bind `IQueueAdapter` to host queue publisher if asynchronous processing for large imports is desired.

### Conflict 4: File Storage Backend
- **Severity**: LOW
- **Affected Component**: `src/infrastructure/storage/`
- **Current Implementation**: `LocalStorageProvider` creating isolated files in `./storage/imports/<orgId>/<importId>/`.
- **Host Application Implementation**: Host may enforce AWS S3 or GCP Cloud Storage.
- **Recommended Resolution**: Swap `LocalStorageProvider` with `S3StorageProvider` (implements identical `IStorageProvider` interface).

### Conflict 5: Audit Log Destination
- **Severity**: LOW
- **Affected Component**: `src/infrastructure/audit/`
- **Current Implementation**: Dual-writes to `data_import_audit_logs` table and stdout structured JSON.
- **Host Application Implementation**: Host may route audit logs to an external SIEM or Kafka topic.
- **Recommended Resolution**: Forward events in `IAuditLogger.record()` to the host's central audit collector.

---

## Summary of Architectural Conflicts
- **CRITICAL**: 0
- **HIGH**: 0
- **MEDIUM**: 2 (Auth Context, Target Entity Service Hook) — Both isolated behind clean adapters.
- **LOW**: 3 (Queue, Storage, Audit) — Built-in pluggable interface support.
