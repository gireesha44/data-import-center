# Data Import Centre — External Contracts Inventory

This document details all external contracts, interfaces, data shapes, and runtime expectations that the Data Import Centre requires from the host application.

---

## 1. User & Authentication Contract

The Data Import Centre does not maintain its own user directory or password store. It expects user context to be provided for all authenticated operations.

### Data Contract: `ISecurityContext`
```typescript
export interface ISecurityContext {
  userId: string;              // Unique identifier of the authenticated user (UUID or string)
  organizationId: string;      // Multi-tenant boundary identifier (UUID or string)
  roles: string[];             // Role strings assigned to user (e.g. ['ADMIN', 'IMPORT_MANAGER'])
  permissions: string[];       // Granular permission strings (e.g. ['IMPORT_CREATE', 'IMPORT_APPROVE'])
  metadata?: Record<string, unknown>; // Optional host-specific user metadata (email, name, ip, etc.)
}
```

### Ingestion Points
1. **HTTP Headers (Default / Gateway Mode)**:
   - `x-organization-id`: Organization / Tenant context (Required)
   - `x-user-id`: Authenticated User ID (Required)
   - `x-user-roles`: Comma-separated list of roles (e.g., `ADMIN,OPERATOR`)
   - `x-user-permissions`: Comma-separated list of granular permissions
2. **Framework Context (Direct Mount Mode)**:
   - Request attachment: `req.user` or `req.tenant` adapted via `securityContextMiddleware`.

---

## 2. Multi-Tenant Context Contract

All data records, imported files, configurations, audit logs, and execution states are isolated by `organizationId`.

```text
Tenant Contract
 ├── organizationId: string (UUID/Identifier)
 ├── Strict scoping: All queries enforce WHERE organization_id = :orgId
 └── Cross-tenant isolation: No cross-tenant reads or writes permitted
```

---

## 3. Target Entity & Mutation Contract (`ITargetMatchProvider`)

To ensure the Data Import Centre does not bypass existing entity validation or trigger raw schema conflicts, all target writes can be delegated to the host application via `ITargetMatchProvider`.

### Interface Definition
```typescript
export interface ITargetMatchProvider {
  /** Find existing records matching unique key constraints */
  findByMatchKeys(
    organizationId: string,
    targetEntity: string,
    matchKeys: Record<string, unknown>
  ): Promise<Record<string, unknown> | null>;

  /** Insert a new target record */
  createRecord(
    organizationId: string,
    targetEntity: string,
    data: Record<string, unknown>,
    context: { userId: string; importId: string; executionId: string }
  ): Promise<{ id: string; [key: string]: unknown }>;

  /** Update an existing target record */
  updateRecord(
    organizationId: string,
    targetEntity: string,
    id: string,
    data: Record<string, unknown>,
    context: { userId: string; importId: string; executionId: string }
  ): Promise<{ id: string; [key: string]: unknown }>;

  /** Delete or soft-delete a target record */
  deleteRecord?(
    organizationId: string,
    targetEntity: string,
    id: string,
    context: { userId: string; importId: string; executionId: string }
  ): Promise<void>;
}
```

---

## 4. File Storage Contract

The Data Import Centre requires temporary or persistent object storage for uploaded import files and generated error/reconciliation export artifacts.

```text
Storage Contract
 ├── upload(fileStream: Readable, key: string, metadata: { organizationId, mimeType }): Promise<string>
 ├── download(key: string, organizationId: string): Promise<ReadableStream>
 ├── delete(key: string, organizationId: string): Promise<void>
 └── getPresignedUrl?(key: string, organizationId: string, expiresInSeconds: number): Promise<string>
```

*Default Standalone Provider*: Local file system storage with automated tenant isolation directory structure (`./storage/<orgId>/<importId>/`).
*Host Integration Provider*: S3 / GCS / Azure Blob Storage adapter.

---

## 5. Audit Logging Contract (`IAuditLogger`)

All lifecycle transitions, approvals, data modifications, and rule overrides emit audit events.

### Data Contract: `IAuditEvent`
```typescript
export interface IAuditEvent {
  id: string;
  organizationId: string;
  userId: string;
  action: string;                 // e.g. 'IMPORT_CREATED', 'IMPORT_APPROVED', 'IMPORT_EXECUTED'
  resourceType: 'DATA_IMPORT';
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}
```

---

## 6. Background Queue & Worker Contract

For asynchronous parsing, validation, and batch execution of large files (> 50,000 rows):

```text
Queue Job Contract
 ├── Job Type: 'DATA_IMPORT_PARSE' | 'DATA_IMPORT_VALIDATE' | 'DATA_IMPORT_EXECUTE'
 ├── Payload:
 │    ├── importId: string
 │    ├── organizationId: string
 │    ├── userId: string
 │    └── executionId?: string
 └── Retry / Dead-Letter:
      ├── Max attempts: 3
      ├── Backoff: Exponential (5s, 15s, 60s)
      └── Dead-letter destination: 'data_import_dlq'
```

---

## 7. Database Infrastructure Contract

The host database must support:
- PostgreSQL 12+ or SQLite 3.35+
- Foreign key enforcement
- JSON / JSONB data types
- Transactional support (`BEGIN`, `COMMIT`, `ROLLBACK`)
- Read-committed isolation level
