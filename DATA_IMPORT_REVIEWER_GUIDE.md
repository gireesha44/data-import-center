# DATA IMPORT CENTRE — CODE REVIEWER & ARCHITECTURAL WALKTHROUGH

This document provides external architects, security reviewers, and lead engineers with a structured guide to review the Data Import Centre codebase.

---

## 1. Review Roadmap

```text
1. Architecture & Core Types ──► 2. Security & File Ingestion ──► 3. Schema & Mapping Engine
                                                                             │
                                                                             ▼
6. Reconciliation & Reporting ◄── 5. Review, Approval & Execution ◄── 4. Validation & Matching
```

---

## 2. Component Review Checklist & Evidence

### Step 1: Architecture & State Machine
- **What to Verify**: 20-state deterministic finite state machine with guarded transitions and terminal state locks.
- **Source Code**: `src/domain/state-machine/import-state-machine.ts`
- **Tests**: `src/tests/unit/state-machine/state-transitions-exhaustive.test.ts`
- **Expected Result**: Illegal jump transitions (e.g. `DRAFT -> COMPLETED`) are rejected with `InvalidStateTransitionError`.

---

### Step 2: File Security, Storage & Parsing
- **What to Verify**: Executable binaries claiming to be CSVs are rejected; zip bombs, XXE, and path traversals are blocked.
- **Source Code**:
  - `src/infrastructure/security/file-security-validator.ts`
  - `src/infrastructure/storage/local-file-storage.service.ts`
  - `src/infrastructure/parsers/` (`csv`, `excel`, `json`, `xml`)
- **Tests**: `src/tests/unit/security/file-security.test.ts`
- **Expected Result**: File format is detected via magic bytes; path traversal in filenames (`../../etc/passwd`) is neutralized.

---

### Step 3: Entity Schema Registry & Column Mapping
- **What to Verify**: Schema definitions act as single source of truth; deterministic token matching suggests mappings with confidence scores.
- **Source Code**:
  - `src/core/registry/entity-schema.registry.ts`
  - `src/domain/mapping/mapping-suggestion.provider.ts`
  - `src/domain/mapping/mapping-validator.service.ts`
- **Tests**: `src/tests/unit/mapping/mapping-suggestion.provider.test.ts`
- **Expected Result**: Required schema fields are enforced; mappings can be saved and retrieved with versioning.

---

### Step 4: 4-Tier Validation & Deduplication Matching
- **What to Verify**: 13 pure transformers cleanse data; 4-tier validators flag errors per-field; length-prefixed match keys group intra-file duplicates.
- **Source Code**:
  - `src/domain/transformers/transformation-pipeline.ts`
  - `src/domain/validation/validation-engine.ts`
  - `src/domain/duplicate/match-key.generator.ts`
  - `src/domain/duplicate/duplicate-detection.engine.ts`
- **Tests**: `src/tests/unit/validation/validation-engine.test.ts`, `src/tests/unit/duplicate/duplicate-detection.engine.test.ts`
- **Expected Result**: Invalid rows are staged with errors without halting valid rows; composite duplicate keys prevent token collision attacks.

---

### Step 5: Review, Governance Approval & Batch Execution
- **What to Verify**: 8-point review checklist verifies readiness; anti-self-approval rule prevents creator approval; SHA-256 snapshot hash locks state; execution runs in 500-record transactional batches.
- **Source Code**:
  - `src/domain/services/review.service.ts`
  - `src/domain/services/approval.service.ts`
  - `src/domain/services/execution.service.ts`
- **Tests**: `src/tests/unit/services/approval.service.test.ts`, `src/tests/integration/phase9-scenarios.test.ts`
- **Expected Result**: Modifying staged data post-approval invalidates snapshot hash; creator self-approval is rejected with 403 Forbidden.

---

### Step 6: Reconciliation, Reporting & Error Recovery
- **What to Verify**: Post-import reconciliation compares intended mutations vs actual target database state; CSV exports sanitize formula injection triggers (`=`, `+`, `-`, `@`, `\t`, `\r`); selective retries re-attempt transient failures.
- **Source Code**:
  - `src/domain/services/reconciliation.service.ts`
  - `src/domain/services/reporting.service.ts`
  - `src/domain/services/retry.service.ts`
  - `src/domain/services/recovery.service.ts`
- **Tests**: `src/tests/unit/services/reconciliation.service.test.ts`, `src/tests/unit/services/reporting.service.test.ts`
- **Expected Result**: Reconciliation flags anomalies; report counts match target state 100%; CSV export escapes formula characters.
