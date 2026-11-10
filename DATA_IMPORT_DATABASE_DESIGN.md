# Data Import Centre — Database Architecture & Schema Design

This document details the complete relational and semi-structured database architecture for the **Data Import Centre**. The schema is designed for PostgreSQL with strict multi-tenant isolation, performance-optimized indexing, streaming/chunked processing support, and full auditability.

---

## 1. Architectural Principles & Tenant Isolation

1. **Strict Multi-Tenancy**: Every primary table contains an `organization_id` foreign key referencing the tenant entity. Compound indexes always lead with `organization_id` to ensure tenant partitioning and index-backed query isolation.
2. **Normalized vs. JSONB Separation**:
   - **Normalized Columns**: Used for identity, foreign keys, status/state-machine transitions, counters, metrics, timestamps, and indexing criteria.
   - **JSONB Columns**: Used for dynamic file headers, column mapping rules, raw payloads, transformed payloads, structured error arrays, and source connection configuration.
3. **Immutability & Staging**:
   - Source data files and raw stage rows (`DataImportRecord`) are preserved in their original state for traceability and reconciliation.
   - Staging records isolate unvalidated data from production core tables until explicit execution.
4. **Optimistic Locking & Execution Idempotency**:
   - `version` columns and execution state locks prevent concurrent double-execution.

---

## 2. Enumerations (Custom Types)

```sql
-- Import Lifecycle Status
CREATE TYPE import_status AS ENUM (
    'DRAFT',
    'UPLOADED',
    'PARSING',
    'PARSED',
    'MAPPING',
    'MAPPED',
    'VALIDATING',
    'VALIDATED',
    'VALIDATION_FAILED',
    'REQUIRES_APPROVAL',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'QUEUED',
    'PROCESSING',
    'COMPLETED',
    'COMPLETED_WITH_ERRORS',
    'FAILED',
    'CANCELLED'
);

-- Source Type
CREATE TYPE import_source_type AS ENUM (
    'FILE_UPLOAD',
    'REST_API',
    'WEBHOOK',
    'INTERNAL_QUERY',
    'SCHEDULED_SYNC'
);

-- File Format
CREATE TYPE import_file_format AS ENUM (
    'CSV',
    'XLSX',
    'XLS',
    'JSON',
    'XML'
);

-- Record Stage Status
CREATE TYPE record_status AS ENUM (
    'PENDING',
    'VALID',
    'INVALID',
    'WARNING',
    'SKIPPED',
    'INSERTED',
    'UPDATED',
    'FAILED'
);

-- Duplicate Handling Strategy
CREATE TYPE duplicate_strategy AS ENUM (
    'SKIP',
    'UPDATE',
    'REJECT',
    'MANUAL_REVIEW'
);

-- Validation Severity
CREATE TYPE validation_severity AS ENUM (
    'ERROR',
    'WARNING',
    'INFORMATION'
);

-- Approval Decision
CREATE TYPE approval_decision AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'INVALIDATED'
);

-- Execution Status
CREATE TYPE execution_status AS ENUM (
    'INITIALIZED',
    'IN_PROGRESS',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
);
```

---

## 3. Entity Definitions

### 3.1 `data_import_sources`
Defines configured or registered ingestion sources (files, endpoints, webhooks, or database views).

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique source identifier |
| `organization_id` | `UUID` | `NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` | Tenant owner |
| `name` | `VARCHAR(255)` | `NOT NULL` | Human-readable source name |
| `source_type` | `import_source_type` | `NOT NULL` | Type of source (File, API, Webhook, etc.) |
| `file_format` | `import_file_format` | `NULL` | Applicable if file-based |
| `connection_config` | `JSONB` | `NOT NULL DEFAULT '{}'` | Encrypted credentials, endpoint URLs, headers, auth config |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` | Active state indicator |
| `created_by` | `UUID` | `NOT NULL REFERENCES users(id)` | Creating user |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Last modification timestamp |

**Indexes & Constraints**:
- `idx_data_import_sources_org` ON (`organization_id`, `created_at` DESC)
- `idx_data_import_sources_type` ON (`organization_id`, `source_type`)

---

### 3.2 `data_imports` (Master Import Entity)
The central entity representing an individual import job lifecycle.

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique import job ID |
| `organization_id` | `UUID` | `NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` | Tenant owner |
| `source_id` | `UUID` | `NULL REFERENCES data_import_sources(id) ON DELETE SET NULL` | Linked source configuration |
| `target_entity_type` | `VARCHAR(100)` | `NOT NULL` | Registered entity type (e.g., `contacts`, `invoices`, `products`) |
| `name` | `VARCHAR(255)` | `NOT NULL` | Import job title/name |
| `status` | `import_status` | `NOT NULL DEFAULT 'DRAFT'` | Current state-machine status |
| `file_name` | `VARCHAR(255)` | `NULL` | Original uploaded file name |
| `file_size_bytes` | `BIGINT` | `NULL` | Size of uploaded payload in bytes |
| `file_mime_type` | `VARCHAR(100)` | `NULL` | MIME type verified via magic numbers |
| `file_storage_path` | `TEXT` | `NULL` | Secure cloud/local object storage path |
| `file_checksum_sha256` | `VARCHAR(64)` | `NULL` | SHA256 file hash for integrity & deduplication |
| `import_options` | `JSONB` | `NOT NULL DEFAULT '{}'` | Options: batch size, skip headers, timezone, duplicate strategy |
| `total_records` | `INTEGER` | `NOT NULL DEFAULT 0` | Total parsed records count |
| `valid_records` | `INTEGER` | `NOT NULL DEFAULT 0` | Valid records count |
| `invalid_records` | `INTEGER` | `NOT NULL DEFAULT 0` | Invalid records count |
| `warning_records` | `INTEGER` | `NOT NULL DEFAULT 0` | Records with warnings |
| `processed_records` | `INTEGER` | `NOT NULL DEFAULT 0` | Successfully processed records count |
| `failed_records` | `INTEGER` | `NOT NULL DEFAULT 0` | Records that failed during final execution |
| `skipped_records` | `INTEGER` | `NOT NULL DEFAULT 0` | Skipped records (duplicates/ignored) |
| `requires_approval` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Flag if import matches approval threshold |
| `created_by` | `UUID` | `NOT NULL REFERENCES users(id)` | Initiating user |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Initial draft creation |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | State update timestamp |
| `completed_at` | `TIMESTAMPTZ` | `NULL` | Completion timestamp |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | Optimistic lock counter |

**Indexes & Constraints**:
- `idx_data_imports_org_status` ON (`organization_id`, `status`, `created_at` DESC)
- `idx_data_imports_org_entity` ON (`organization_id`, `target_entity_type`, `created_at` DESC)
- `idx_data_imports_created_by` ON (`organization_id`, `created_by`)

---

### 3.3 `data_import_mappings`
Stores the column-level mapping, default values, and transformation pipeline configured for an import.

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Mapping ID |
| `organization_id` | `UUID` | `NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` | Tenant owner |
| `import_id` | `UUID` | `NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE` | Associated import job |
| `source_columns` | `JSONB` | `NOT NULL` | Array of detected source columns and sample values |
| `column_mappings` | `JSONB` | `NOT NULL` | Map: `source_col -> { target_field, data_type, required }` |
| `transformations` | `JSONB` | `NOT NULL DEFAULT '{}'` | Transformation rules per column (e.g. date format, trim, regex) |
| `default_values` | `JSONB` | `NOT NULL DEFAULT '{}'` | Fallback values for unmapped required fields |
| `unmapped_behavior` | `VARCHAR(50)` | `NOT NULL DEFAULT 'IGNORE'` | Action for unmapped fields: `IGNORE`, `SET_NULL` |
| `is_valid` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | True if all required destination fields are satisfied |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Last updated timestamp |

**Indexes & Constraints**:
- `uq_data_import_mappings_import` UNIQUE (`import_id`)
- `idx_data_import_mappings_org` ON (`organization_id`)

---

### 3.4 `data_import_templates`
Reusable mapping and import configurations that can be applied to new imports of the same schema.

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Template ID |
| `organization_id` | `UUID` | `NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` | Tenant owner |
| `target_entity_type` | `VARCHAR(100)` | `NOT NULL` | Target entity schema key |
| `name` | `VARCHAR(255)` | `NOT NULL` | Template name (e.g., "Shopify Customers Mapping") |
| `description` | `TEXT` | `NULL` | Detailed description |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | Template version number |
| `column_mappings` | `JSONB` | `NOT NULL` | Reusable mapping definition |
| `transformations` | `JSONB` | `NOT NULL DEFAULT '{}'` | Reusable transformation rules |
| `default_values` | `JSONB` | `NOT NULL DEFAULT '{}'` | Reusable default values |
| `is_public` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Tenant-wide vs private template |
| `created_by` | `UUID` | `NOT NULL REFERENCES users(id)` | Author |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Created timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Updated timestamp |

**Indexes & Constraints**:
- `uq_data_import_templates_name` UNIQUE (`organization_id`, `target_entity_type`, `name`, `version`)
- `idx_data_import_templates_org_entity` ON (`organization_id`, `target_entity_type`)

---

### 3.5 `data_import_records` (Staging Table)
Stores individual records parsed from the source file. Enables paginated preview, dry-run validation, diff inspection, and record-level retry.

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Staged record ID |
| `organization_id` | `UUID` | `NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` | Tenant owner |
| `import_id` | `UUID` | `NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE` | Parent import job |
| `row_index` | `INTEGER` | `NOT NULL` | Original row number in source file (1-indexed) |
| `raw_data` | `JSONB` | `NOT NULL` | Original parsed record exactly as received |
| `transformed_data` | `JSONB` | `NULL` | Data after applying mapping, transforms & defaults |
| `status` | `record_status` | `NOT NULL DEFAULT 'PENDING'` | Current status of this individual record |
| `validation_errors` | `JSONB` | `NOT NULL DEFAULT '[]'` | Array of structured errors: `[{field, rule, message, severity}]` |
| `is_duplicate` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Duplicate detection flag |
| `duplicate_match_id` | `UUID` | `NULL` | ID of existing record if duplicate detected |
| `duplicate_strategy` | `duplicate_strategy` | `NULL` | Chosen strategy for this record |
| `target_record_id` | `UUID` | `NULL` | ID of created/updated target entity record on execution |
| `execution_error` | `TEXT` | `NULL` | Execution-time error message if insertion failed |
| `retry_count` | `INTEGER` | `NOT NULL DEFAULT 0` | Number of retry attempts |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Ingest timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Last updated timestamp |

**Indexes & Constraints**:
- `uq_data_import_records_row` UNIQUE (`import_id`, `row_index`)
- `idx_data_import_records_filter` ON (`organization_id`, `import_id`, `status`)
- `idx_data_import_records_duplicate` ON (`import_id`, `is_duplicate`) WHERE `is_duplicate` = TRUE
- `idx_data_import_records_gin_raw` ON `data_import_records` USING GIN (`raw_data`)
- `idx_data_import_records_gin_transformed` ON `data_import_records` USING GIN (`transformed_data`)

---

### 3.6 `data_import_approvals`
Tracks approval workflows, approver decisions, reasoning, and change invalidation checksums.

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Approval request ID |
| `organization_id` | `UUID` | `NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` | Tenant owner |
| `import_id` | `UUID` | `NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE` | Parent import job |
| `decision` | `approval_decision` | `NOT NULL DEFAULT 'PENDING'` | Decision state |
| `requested_by` | `UUID` | `NOT NULL REFERENCES users(id)` | User requesting approval |
| `requested_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Request timestamp |
| `decided_by` | `UUID` | `NULL REFERENCES users(id)` | Approver / Rejecter user |
| `decided_at` | `TIMESTAMPTZ` | `NULL` | Decision timestamp |
| `reason` | `TEXT` | `NULL` | Comments / reason for decision |
| `snapshot_hash` | `VARCHAR(64)` | `NOT NULL` | SHA256 of (file_hash + mapping_hash + options) to detect post-approval edits |
| `invalidation_reason` | `TEXT` | `NULL` | Reason if invalidated due to data or mapping modification |

**Indexes & Constraints**:
- `idx_data_import_approvals_import` ON (`organization_id`, `import_id`, `decision`)
- `idx_data_import_approvals_pending` ON (`organization_id`, `decision`) WHERE `decision` = 'PENDING'

---

### 3.7 `data_import_executions`
Maintains execution run history, batching progress, throughput metrics, and worker locks.

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Execution run ID |
| `organization_id` | `UUID` | `NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` | Tenant owner |
| `import_id` | `UUID` | `NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE` | Parent import job |
| `status` | `execution_status` | `NOT NULL DEFAULT 'INITIALIZED'` | Status of this execution run |
| `worker_node_id` | `VARCHAR(100)` | `NULL` | Host/worker instance holding execution lock |
| `started_at` | `TIMESTAMPTZ` | `NULL` | Execution start timestamp |
| `finished_at` | `TIMESTAMPTZ` | `NULL` | Execution end timestamp |
| `duration_ms` | `INTEGER` | `NULL` | Total runtime in milliseconds |
| `batch_size` | `INTEGER` | `NOT NULL DEFAULT 500` | Processed batch size |
| `total_batches` | `INTEGER` | `NOT NULL DEFAULT 0` | Total batches planned |
| `completed_batches` | `INTEGER` | `NOT NULL DEFAULT 0` | Total batches finished |
| `records_succeeded` | `INTEGER` | `NOT NULL DEFAULT 0` | Successfully committed records |
| `records_failed` | `INTEGER` | `NOT NULL DEFAULT 0` | Records failed in transaction |
| `error_summary` | `JSONB` | `NOT NULL DEFAULT '{}'` | Aggregated execution errors |
| `cancelled_by` | `UUID` | `NULL REFERENCES users(id)` | User who cancelled if aborted |

**Indexes & Constraints**:
- `idx_data_import_executions_import` ON (`organization_id`, `import_id`, `started_at` DESC)
- `idx_data_import_executions_active` ON (`status`) WHERE `status` = 'IN_PROGRESS'

---

### 3.8 `data_import_audit_logs`
Append-only immutable audit trail capturing every state change, user interaction, approval, and execution event.

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGSERIAL` | `PRIMARY KEY` | Monotonic audit event ID |
| `organization_id` | `UUID` | `NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` | Tenant owner |
| `import_id` | `UUID` | `NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE` | Associated import job |
| `actor_user_id` | `UUID` | `NULL REFERENCES users(id)` | User performing the action (or system) |
| `action` | `VARCHAR(100)` | `NOT NULL` | Action key (e.g., `IMPORT_CREATED`, `FILE_UPLOADED`, `MAPPING_UPDATED`, `VALIDATION_RUN`, `APPROVAL_GRANTED`, `EXECUTION_STARTED`, `EXECUTION_COMPLETED`, `RECORD_RETRY`) |
| `from_state` | `VARCHAR(50)` | `NULL` | Previous status if state transition |
| `to_state` | `VARCHAR(50)` | `NULL` | New status if state transition |
| `details` | `JSONB` | `NOT NULL DEFAULT '{}'` | Action context, parameters, diff, IP address, user agent |
| `timestamp` | `TIMESTAMPTZ` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Exact event timestamp |

**Indexes & Constraints**:
- `idx_data_import_audit_logs_import` ON (`organization_id`, `import_id`, `timestamp` ASC)
- `idx_data_import_audit_logs_action` ON (`organization_id`, `action`, `timestamp` DESC)

---

## 4. Normalization vs. JSONB Rationale

| Layer / Field | Storage Strategy | Rationale |
|---|---|---|
| **Tenant (`organization_id`)** | Normalized `UUID` | Essential for row-level security, composite indexing, and database partitioning. |
| **Status / State** | Normalized `ENUM` | Fast state machine querying, indexed filtering, and database-enforced integrity. |
| **Counters (`total_records`, etc.)** | Normalized `INTEGER` | O(1) progress calculations and aggregate metric queries without scanning JSONB blobs. |
| **Source Records (`raw_data`)** | Flexible `JSONB` | Source files can contain any arbitrary, variable column schema that cannot be predicted statically. |
| **Transformed Records (`transformed_data`)** | Flexible `JSONB` | Allows staging of structured payloads before entity mapping without altering physical database tables. |
| **Mapping Rules (`column_mappings`)** | Structured `JSONB` | Dynamic mapping structure allowing rich nested configuration (rules, cast types, fallbacks). |
| **Validation Errors (`validation_errors`)** | Structured `JSONB` | Arrays of error objects per cell/row with metadata (line, column, rule, severity). |
