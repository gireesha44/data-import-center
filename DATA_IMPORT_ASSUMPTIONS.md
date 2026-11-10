# Data Import Centre — Explicit Assumptions, Architecture Decisions & Gap Analysis

This document details all baseline requirements, conscious architectural decisions, identified ambiguities, and external service dependency boundaries for the **Data Import Centre**.

---

## 1. Requirements Explicitly Defined by the Specification

The following core requirements are explicitly stated in the platform specification and serve as the immutable baseline:

1. **Multi-Source Support**: Ingestion of CSV, Excel (`.xlsx`, `.xls`), JSON, and XML files, with extensible support for external REST APIs, webhooks, and internal queries.
2. **Dynamic Entity & Schema Registry**: A central schema registry defining importable entities, validation rules, relationship lookups, and duplicate keys without hardcoding fields across disparate layers.
3. **Interactive Column Mapping Studio**: Auto-matching, manual field-to-column mapping, required field indicators, type safety checks, unmapped field policies, and reusable mapping templates.
4. **Deterministic Transformation Pipeline**: Standard transformations including whitespace trimming, casing changes, date/time normalization (with explicit timezone handling), phone normalization (E.164), enum mapping, string splitting/concatenation, number normalization, and reference lookups.
5. **Multi-Tier Validation**: File-level, field-level, cross-field, and foreign reference validation with tiered severity levels (`ERROR`, `WARNING`, `INFORMATION`).
6. **Configurable Duplicate Detection**: Detection by unique IDs, business natural keys, and composite fields, with user-selected resolution strategies (`SKIP`, `UPDATE`, `REJECT`, `MANUAL_REVIEW`).
7. **Approval Workflow**: Threshold-driven and permission-based approval requirements, with tamper-detection invalidation if source data or mappings change post-approval.
8. **Asynchronous Batch Execution Engine**: Queue-driven batching, transaction rollback per batch or overall, real-time progress broadcasting, cooperative cancellation, and record-level failure isolation with retry capability.
9. **Import History, Reporting & Auditing**: Detailed execution metrics, downloadable error reports, immutable audit logs, and searchable historical import logs.
10. **Strict Multi-Tenant Isolation & RBAC**: Every operation, staged record, template, and execution is strictly isolated by `organization_id` and guarded by granular permissions.

---

## 2. Requirements Requiring Implementation Decisions

To translate the functional specification into a robust, scalable system, the following technical design decisions are established:

1. **Staging Storage Model**: Staged rows are stored in a dedicated `data_import_records` PostgreSQL table using `JSONB` for `raw_data` and `transformed_data`. This permits high-performance SQL querying, sorting, paginated preview, and diff inspection while accommodating arbitrary column structures without dynamic table creation.
2. **Queue and Worker Architecture**: The execution worker utilizes an asynchronous job queue (such as BullMQ / Redis or dedicated database queue workers) with partitioned worker pools to isolate heavy parsing/transformations from transactional execution.
3. **Change Detection via Cryptographic Hash**: Approval invalidation is calculated using a SHA256 checksum over the tuple: `(file_checksum, column_mappings_hash, transformations_hash, import_options_hash)`. Any mutation updates the hash; if it differs from the approval record's `snapshot_hash`, the approval status is automatically transitioned to `INVALIDATED`.
4. **Memory-Bounded Streaming Parsers**: File parsers (CSV parser, Excel streaming reader via SAX/stream, streaming JSON parser) must process files in chunks of up to 1,000 rows to guarantee sub-256MB worker memory footprints even with 500k-row files.
5. **Batch Transaction Isolation**: Execution commits in configurable batches (e.g., 500 records per transaction). If a batch fails, individual record errors are logged to `data_import_records`, and non-conflicting batches remain committed, unless atomic "all-or-nothing" mode is explicitly selected by the user.

---

## 3. Ambiguities in Specification & Resolved Interpretations

| Area | Ambiguity in Spec | Resolved Implementation Interpretation |
|---|---|---|
| **Atomic vs. Partial Failure Execution** | Spec mentions both transaction rollback and record-level partial retry. | System will offer a per-import configurable mode: **`ALL_OR_NOTHING`** (single rollback on any unhandled failure) vs. **`CONTINUE_ON_ERROR`** (commit valid records in batches, stage failed records for individual inspection and retry). Default is `CONTINUE_ON_ERROR`. |
| **Duplicate Update Scope** | When duplicate strategy is `UPDATE`, how are unmapped/null fields handled? | If a target field is not mapped or null in the source, the existing target entity value is **preserved** (patch semantics), rather than overwritten with null, unless an explicit overwrite flag is enabled in the mapping. |
| **Approval Invalidation Threshold** | Does editing a cosmetic description invalidate an approved import? | Only **material changes** (changes to the source file, column mapping, transformation logic, or duplicate strategy) invalidate approval. Updating the import job name/tags does not trigger invalidation. |
| **Reference Lookup Failures** | If a foreign key lookup (e.g. `Department Name -> ID`) fails, what is the severity? | Lookup failures default to severity `ERROR`, blocking record execution. However, if the field is optional, the transformation can be configured to `SET_NULL` with a `WARNING`. |

---

## 4. External Integrations Requiring External Credentials & Services

The following external dependencies cannot be fully executed in isolated local environments without live credentials:

1. **Third-Party Cloud Storage (AWS S3 / Azure Blob / GCS)**:
   - *Status*: File storage is abstracted behind an `IFileStorageService` interface. Local disk storage is used in local/testing environments; S3/Blob storage will be activated when cloud credentials (`S3_BUCKET`, `AWS_ACCESS_KEY_ID`, etc.) are provided.
2. **Third-Party REST API Connectors (Salesforce, HubSpot, Shopify, etc.)**:
   - *Status*: Concrete API extractors require OAuth credentials and tenant API keys. The system implements a robust `IApiSourceConnector` interface with complete request lifecycle, retry, and rate-limit handling, while specific third-party connectors are configured dynamically per tenant.
3. **AI LLM Providers (OpenAI, Anthropic, Gemini)**:
   - *Status*: AI assistance (mapping suggestions, error natural language explanations) is decoupled behind `IAiAssistantService`. If API keys are missing or the service is offline, the feature gracefully disables without impacting manual mapping or validation workflows.
4. **Email / Slack Notification Dispatcher**:
   - *Status*: Approval and completion notifications run through `INotificationService` with console/log fallback when SMTP or Webhook URLs are not configured.

---

## 5. Features Initially Implemented as Abstractions / Interfaces

To ensure zero vendor lock-in and high extensibility, the following systems are designed as swappable interfaces:

- `IFileParser`: Standardized parsing contract implemented by `CsvFileParser`, `ExcelFileParser`, `JsonFileParser`, and `XmlFileParser`.
- `IEntitySchemaRegistry`: Interface for registering importable business entities and their schema contracts.
- `ITransformationRule`: Interface for deterministic cell transformations (`Trim`, `DateFormat`, `PhoneFormat`, `RegexReplace`, `LookupTransform`, etc.).
- `IValidationRule`: Interface for field-level, cross-field, and reference validation rules.
- `IExecutionCoordinator`: Contract for batch execution, transaction control, and target database mutation.
- `IFileStorageService`: Storage abstraction for staged uploaded files and generated reports.
- `IAiAssistantService`: Clean abstraction for LLM-powered suggestions.

---

## 6. What Must NOT Be Fabricated or Mocked as Production Functionality

1. **No Fake / In-Memory Mock Databases in Production**: The system must run against real PostgreSQL database schemas with real transactions, real foreign keys, and real constraint enforcement.
2. **No Hardcoded Entity Schemas in Multiple Locations**: Entity definitions must reside exclusively in the `SchemaRegistry`.
3. **No Unauthenticated Execution**: All worker jobs must authenticate against the execution context of the originating tenant and user.
4. **No Fake AI Responses in Production**: When AI credentials are not present, the UI will clearly indicate "AI assistance not configured" rather than returning fabricated fake mappings.
5. **No Bypassing File Security**: Magic number checks, zip bomb decompressed size limits, and XML external entity (`XXE`) disabling must always be active in all environments.

---

## 7. Phase 11 Final Assumption Audit & Classification Matrix

| Assumption ID | Topic | Initial Assumption | Phase 11 Classification | Resolution / Host Verification Action |
| :--- | :--- | :--- | :---: | :--- |
| **ASM-001** | Database Engine | PostgreSQL with JSONB support | **CONFIRMED** | Schema written in standard PostgreSQL DDL (`001_create_data_import_schema.sql`). |
| **ASM-002** | File Formats | CSV, XLSX, XLS, JSON, XML | **CONFIRMED** | Stream parsers implemented and verified for all 5 formats. |
| **ASM-003** | Multi-Tenancy | Scoped by `organization_id` string | **REQUIRES EXISTING PROJECT VERIFICATION** | Verify whether host project uses `organization_id`, `tenant_id`, or `company_id`. |
| **ASM-004** | User Identification | User ID passed via security context | **REQUIRES EXISTING PROJECT VERIFICATION** | Adapt `securityContextMiddleware` to host session / JWT token payload. |
| **ASM-005** | Storage Engine | Local filesystem or S3 | **CONFIRMED** | Decoupled behind `IFileStorageService` with local and S3 compatibility. |
| **ASM-006** | Segregation of Duties| Creator cannot approve own import | **CONFIRMED** | Enforced in `ApprovalService` with configurable bypass flag (`ENFORCE_SEPARATION_OF_DUTIES`). |
| **ASM-007** | Staged Records | Stored in PostgreSQL table with JSONB | **CONFIRMED** | `data_import_records` stores high-throughput staged rows with validation status. |
| **ASM-008** | Batch Execution Size| 500 records per transaction | **CONFIRMED** | Configurable via `DEFAULT_BATCH_SIZE` and request payload. |
| **ASM-009** | Target Data Writing | Target mutations via `ITargetMatchProvider` | **CONFIRMED** | Clean interface allows host application to execute writes directly or via domain service. |
| **ASM-010** | Formula Neutralization| Escape `=`, `+`, `-`, `@`, `\t`, `\r` | **CONFIRMED** | Implemented and verified in `ReportingService` CSV export. |

