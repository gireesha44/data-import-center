# DATA IMPORT CENTRE — COMPLETE DATA FLOW SPECIFICATION

This document details the exact end-to-end data pipeline flow across all 12 stages of the **Data Import Centre**.

---

## 1. Pipeline Overview

```text
[1. Upload] ──► [2. Parse] ──► [3. Map] ──► [4. Transform] ──► [5. Validate] ──► [6. Deduplicate & Match]
                                                                                          │
                                                                                          ▼
[12. Final Report] ◄── [11. Export] ◄── [10. Reconcile] ◄── [9. Execute] ◄── [8. Approve] ◄── [7. Review]
```

---

## 2. Stage-by-Stage Detailed Data Flow

### Stage 1: File Upload & Ingestion
- **Input**: Raw file buffer (CSV / XLSX / JSON / XML), original filename, declared MIME type, user security context.
- **Processing**: `FileSecurityValidator` verifies magic bytes, detects true file type, enforces max file size (100MB), strips dangerous XML entity expansion (`XXE`), and `LocalFileStorageService` computes SHA-256 checksum and stages file in temporary storage with sanitized filename.
- **Database Mutation**: `data_imports` record created in `DRAFT` or `UPLOADED` state with `file_size_bytes`, `storage_path`, and `checksum_sha256`.
- **Output**: Import ID, file metadata, status `UPLOADED`.
- **Possible Failures**: `ValidationError` (file empty/too large), `SecurityViolationError` (executable binary or XXE detected).

---

### Stage 2: Parsing & Header Discovery
- **Input**: Staged file on disk, format options (delimiter, sheet, encoding, skipHeaderRows).
- **Processing**: Appropriate parser (`CsvParser`, `ExcelParser`, `JsonParser`, `XmlParser`) reads file in streams/chunks, strips UTF-8 BOM, extracts raw column headers, generates sample row previews, and normalizes column headers.
- **Database Mutation**: `data_imports` updated with `status = 'PARSED'`, `total_records`, and raw `headers` metadata.
- **Output**: List of source columns with inferred types and 10-row sample preview.
- **Possible Failures**: `FileParsingError` (corrupt spreadsheet, unclosed quotes, invalid JSON structure).

---

### Stage 3: Column Mapping & Schema Matching
- **Input**: User column mapping payload `Record<sourceHeader, ColumnMapping>`.
- **Processing**: `DeterministicMappingSuggestionProvider` computes fuzzy and token-based similarity against registered `EntitySchemaDefinition`. `MappingValidatorService` validates that all required schema fields are mapped and data types are compatible.
- **Database Mutation**: Saves `DataImportMappingEntity` to `data_import_mappings`. Updates `data_imports.status = 'MAPPED'`.
- **Output**: Validated column mapping configuration entity.
- **Possible Failures**: `ValidationError` (unmapped mandatory fields, incompatible type conversions).

---

### Stage 4 & 5: Transformation & 4-Tier Validation
- **Input**: Parsed raw rows and active mapping configuration.
- **Processing**:
  - `TransformationPipeline` executes 13 pure deterministic transformers (e.g. `trim`, `lowercase`, `to_date`, `to_decimal`, `phone_format`).
  - `ValidationEngine` executes 4-tier validation:
    1. **Tier 1 (Syntax)**: Nullability, UTF-8 validity.
    2. **Tier 2 (Field Rules)**: Data types, regex constraints, numeric ranges, enum whitelists.
    3. **Tier 3 (Cross-Field)**: Multi-field relational constraints (e.g. `due_date >= issue_date`).
    4. **Tier 4 (DB/Reference)**: Foreign reference lookups.
- **Database Mutation**: Staged rows are inserted/updated in `data_import_records` with `transformed_data`, `status` (`VALID`, `WARNING`, or `INVALID`), and `validation_errors`. Updates `data_imports.status = 'VALIDATED'`.
- **Output**: Validation summary ({ validRows, invalidRows, warningRows, totalErrors }).
- **Possible Failures**: Critical validation errors cause state transition to `VALIDATION_FAILED`.

---

### Stage 6: Duplicate Detection & Target Record Matching
- **Input**: Validated staged records and entity duplicate rules.
- **Processing**: `DuplicateDetectionEngine` generates canonical token match keys (`hash:length:tokens`). `ITargetMatchProvider` searches existing database target records. Intra-file duplicates are grouped. `ExecutionAction` is determined (`CREATE`, `UPDATE`, `SKIP`, `CONFLICT`).
- **Database Mutation**: Updates `data_import_records` with `match_key_hash`, `matched_target_id`, `match_confidence`, and `execution_action`.
- **Output**: Duplicate summary ({ newRecords, existingRecords, duplicateInFile, conflicts }).
- **Possible Failures**: Unresolvable match conflicts flagged for human review.

---

### Stage 7 & 8: Pre-Execution Review & Governance Approval
- **Input**: Review request by authorized user.
- **Processing**:
  - `ReviewService` evaluates the 8-point governance checklist (unmapped fields, validation errors, duplicate count, conflict count, schema lock, etc.).
  - `ApprovalService` verifies anti-self-approval rule (creator cannot approve own import), evaluates approval policy, and creates cryptographic SHA-256 snapshot hash of all staged rows and mapping.
- **Database Mutation**: Inserts `data_import_approvals` record with `snapshot_hash` and `decision = 'APPROVE'`. Updates `data_imports.status = 'APPROVED'`.
- **Output**: Approval receipt with approval timestamp and snapshot hash.
- **Possible Failures**: `ForbiddenError` (anti-self-approval violation or missing `DATA_IMPORT_APPROVE` permission).

---

### Stage 9: Transactional Batch Execution
- **Input**: Import ID, batch size (default 500 records).
- **Processing**: `ExecutionService` validates approval snapshot hash against current state, acquires execution lock, processes records in 500-row chunks inside transactional boundaries, executes target mutations (`createRecord`, `updateRecord`), captures individual row write results.
- **Database Mutation**: Writes to target tables (e.g. `contacts`), inserts `data_import_executions` record, updates each `data_import_records.status = 'EXECUTED'` or `'FAILED'`, updates `data_imports.status = 'EXECUTED'`.
- **Output**: Execution summary ({ successfulCreates, successfulUpdates, skippedRecords, failedRecords }).
- **Possible Failures**: Target constraint errors isolated per-row; fatal connection drop sets `FAILED`.

---

### Stage 10: Post-Import Reconciliation
- **Input**: Executed import ID.
- **Processing**: `ReconciliationService` performs row-by-row audit comparing intended action (`CREATE`/`UPDATE`) against actual target database state, verifies checksums, and detects discrepancies or anomalies.
- **Database Mutation**: Inserts `data_import_reconciliations` record, updates `data_imports.status = 'COMPLETED'` (or `'COMPLETED_WITH_ERRORS'`).
- **Output**: Reconciliation summary ({ status: 'FULLY_RECONCILED', mismatchCount: 0 }).
- **Possible Failures**: Target discrepancy transitions status to `COMPLETED_WITH_ERRORS` and triggers alert.

---

### Stage 11 & 12: Reporting, Safe CSV Export & Retry
- **Input**: Report request for completed or failed import.
- **Processing**:
  - `ReportingService` generates 5-tier final report (Import Info, Mapping Summary, Validation Breakdown, Execution Metrics, Reconciliation Verification).
  - Failed-records CSV export automatically escapes spreadsheet formula injection triggers (`=`, `+`, `-`, `@`, `\t`, `\r`).
  - `RetryService` allows selective re-execution of transient failures up to maximum 3 attempts without duplicating successful rows.
- **Database Mutation**: Increments `data_imports.retry_count`, logs immutable audit entries in `data_import_audit_logs`.
- **Output**: Formatted JSON report or sanitized CSV download.
