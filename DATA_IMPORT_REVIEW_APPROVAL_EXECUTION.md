# Data Import Centre — Import Review, Approval & Execution Engine Architecture

## 1. Executive Summary & Architectural Overview

Phase 7 implements the **Import Review, Approval, and Execution Engine** for the enterprise Data Import Centre. It connects the pipeline from file ingestion, parsing, column mapping, deterministic transformation, multi-tier validation, and duplicate detection into a governed, explainable review process, cryptographic approval workflow, and a transactional batch execution engine.

```text
Uploaded File
      ↓
Parsing & Normalization
      ↓
Column Mapping
      ↓
Transformation Pipeline
      ↓
Progressive Multi-Tier Validation
      ↓
Duplicate Detection & Matching
      ↓
Server-Side Review & Readiness Engine (8-Point Pre-Execution Checklist)
      ↓
Governance Approval Workflow (Separation of Duties & SHA-256 Snapshot Invalidation)
      ↓
Immutable Execution Plan Generation
      ↓
Transactional Batch Execution Engine (500 rows/batch, atomic create/update/skip/block)
      ↓
Target Entity Writes & Idempotent Mutation Confirmation
      ↓
Execution Summary, Reconciliation & Audit Logging
```

---

## 2. Server-Side Review & Readiness Evaluation

Readiness is evaluated authoritatively on the server prior to execution. The system verifies an **8-Point Pre-Execution Checklist**:

| Checklist Item Code | Verification Rule | Blocking? | Failure Impact |
|---|---|---|---|
| `FILE_PARSED` | Staged dataset contains rows and parser completed successfully | Yes | Prevents review progression |
| `MAPPING_CONFIGURED` | Column mapping definition exists in repository | Yes | Blocks review |
| `REQUIRED_FIELDS_MAPPED` | All mandatory target schema fields are mapped | Yes | Blocks readiness |
| `VALIDATION_COMPLETED` | Dataset multi-tier validation has executed | Yes | Blocks readiness |
| `NO_VALIDATION_ERRORS` | Zero records with `ERROR` severity | Informational / Action | Non-blocking (invalid records are isolated and `BLOCKED`) |
| `DUPLICATE_DETECTION_COMPLETED` | Matching engine has assigned classifications and intents | Yes | Blocks readiness |
| `NO_BLOCKING_CONFLICTS` | Ambiguous `MULTIPLE_MATCH` conflicts | Informational / Action | Conflicted rows are marked `BLOCKED` |
| `APPROVAL_SATISFIED` | Formal approval granted if required by entity policy or volume threshold | Yes | Blocks execution until approved |

### Overall Readiness Classification:
- **`READY`**: All prerequisites pass; zero blocking issues.
- **`BLOCKED`**: One or more blocking checklist items failed (e.g. unmapped mandatory field, unapproved sensitive job).
- **`NOT_READY`**: Upstream stages (parsing, validation, or matching) have not yet been initiated.

---

## 3. Governance Approval Workflow & Cryptographic Snapshotting

### 3.1. Entity Schema Approval Policy
The schema registry governs when approval is mandatory:
- **Default Requirement**: High-governance entities (e.g. `contacts`, `finance`).
- **Volume Threshold**: Imports exceeding configured row limits (e.g. $\ge 5,000$ rows).
- **Sensitive Mode**: Imports executing in update mode or modifying existing records.

### 3.2. Separation of Duties
To prevent fraudulent or unauthorized self-approvals, the user who created or uploaded an import job is strictly prohibited from approving their own job:
$$\text{context.userId} == \text{importJob.createdBy} \implies \text{HTTP 403 Forbidden}$$

### 3.3. Cryptographic State Snapshotting & Stale Invalidation
When an import is approved, a deterministic SHA-256 snapshot hash is computed from its state:
$$\text{SnapshotHash} = \text{SHA-256}(\text{Canonical}(\text{importId, version, mapping, stagedSignatures}))$$
If any user modifies column mappings, reruns validation, or alters duplicate strategies, the snapshot hash becomes mismatched, **immediately invalidating prior approval** and requiring formal re-approval.

---

## 4. Transactional Batch Execution Engine

### 4.1. Single Entry Point for Target Writes
Target writes (`CREATE`, `UPDATE`, `SKIP`) occur exclusively through `ExecutionService` and the `ITargetMatchProvider` abstraction. No HTTP controller or user payload can trigger raw database queries.

### 4.2. Action Execution Semantics
- **`CREATE`**: Invokes `targetProvider.createRecord()`, assigns generated `targetRecordId`, marks staged record `status = RecordStatus.CREATED`.
- **`UPDATE`**: Verifies target existence, invokes `targetProvider.updateRecord()`, marks staged record `status = RecordStatus.UPDATED`.
- **`SKIP`**: Bypasses target mutations, marks staged record `status = RecordStatus.SKIPPED`.
- **`BLOCKED`**: Bypasses target mutations, records `status = RecordStatus.REJECTED` with blocking reason.

### 4.3. Batch Transaction Sizing & Partial Failure Handling
- Rows are processed in configurable atomic chunks (default 500 records).
- **`CONTINUE_ON_ERROR`**: If a record fails during batch execution (e.g. target constraint failure), the failed record is recorded as `status = RecordStatus.FAILED`, and the engine continues processing remaining rows.
- **`ALL_OR_NOTHING`**: If any row fails, the batch transaction aborts and execution is halted.

### 4.4. Concurrency Locking & Idempotency
- Concurrency locks prevent duplicate execution runs on the same import job.
- Re-executing an already completed import job is safely rejected with idempotency guarantees.

---

## 5. REST API Specifications

| Method & Route | RBAC Permission | Purpose |
|---|---|---|
| `GET /api/v1/data-imports/:id/review` | `DATA_IMPORT_VIEW` | Returns readiness status, review summary, and 8-point checklist. |
| `GET /api/v1/data-imports/:id/review/records` | `DATA_IMPORT_VIEW` | Paginated review table with classification, intent, and error filters. |
| `GET /api/v1/data-imports/:id/review/records/:recordId` | `DATA_IMPORT_VIEW` | Detailed before/after field comparisons for a single record. |
| `POST /api/v1/data-imports/:id/approve` | `DATA_IMPORT_APPROVE` | Approves import job; records snapshot hash and enforces separation of duties. |
| `POST /api/v1/data-imports/:id/reject` | `DATA_IMPORT_APPROVE` | Rejects import job with mandatory reason. |
| `POST /api/v1/data-imports/:id/execute` | `DATA_IMPORT_EXECUTE` | Triggers transactional batch execution. |
| `GET /api/v1/data-imports/:id/execution` | `DATA_IMPORT_VIEW` | Returns real-time execution progress, batch counts, and duration metrics. |
| `GET /api/v1/data-imports/:id/report` | `DATA_IMPORT_VIEW` | Returns structured error export for failed execution rows. |

---

## 6. Audit Trail & Immutability

Every critical operation records an immutable audit log entry in `data_import_audit_logs`:
- `IMPORT_APPROVED`
- `IMPORT_REJECTED`
- `IMPORT_EXECUTION_STARTED`
- `IMPORT_EXECUTION_COMPLETED`
- `IMPORT_EXECUTION_FAILED`
