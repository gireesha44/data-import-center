# Data Import Centre — Comprehensive Implementation Plan

This document establishes the step-by-step, 12-phase technical execution plan for building the **Data Import Centre**. Each phase is granular, modular, and designed so that a development team or coding agent can execute sequentially without ambiguity.

---

## Phase 1: Architecture & Foundation

- **Goal**: Establish project directory structure, core interfaces, configuration management, error hierarchies, and dependency injection setup.
- **Prerequisites**: Node.js / TypeScript environment, package dependencies defined.
- **Tasks**:
  1. Define folder layout (`src/core`, `src/modules/data-import`, `src/common`).
  2. Implement unified application error classes (`ImportValidationError`, `ParsingError`, `SecurityViolationError`, `StateTransitionError`).
  3. Define core domain interfaces (`ISourceAdapter`, `IFileParser`, `ITransformationRule`, `IValidationRule`, `IEntitySchemaRegistry`, `IExecutionCoordinator`).
  4. Configure environment variable validation and multi-tenant context propagation.
- **Expected Files / Modules**:
  - `src/core/errors/import.errors.ts`
  - `src/core/interfaces/source.interface.ts`
  - `src/core/interfaces/parser.interface.ts`
  - `src/core/interfaces/schema.interface.ts`
  - `src/core/interfaces/transform.interface.ts`
  - `src/core/interfaces/validation.interface.ts`
  - `src/core/interfaces/execution.interface.ts`
- **Database Changes**: None.
- **API Changes**: None.
- **Frontend Changes**: None.
- **Tests**: Unit tests for custom error serialization and context propagation.
- **Acceptance Criteria**: All interfaces and shared types compile cleanly under strict TypeScript mode.
- **Potential Risks**: Incomplete interface signatures requiring refactoring in later phases.

---

## Phase 2: Database & Domain Models

- **Goal**: Implement relational database migrations, domain entity definitions, repository layers, and state machine transitions.
- **Prerequisites**: Phase 1 foundation complete; PostgreSQL connection available.
- **Tasks**:
  1. Write SQL migrations for all 8 core tables and custom ENUM types.
  2. Implement composite indexes and tenant isolation foreign keys.
  3. Create domain model classes / ORM entities with lifecycle hooks.
  4. Implement the strict `ImportStateMachine` class with transition guards.
- **Expected Files / Modules**:
  - `src/database/migrations/001_create_data_import_schema.sql`
  - `src/modules/data-import/domain/entities/data-import.entity.ts`
  - `src/modules/data-import/domain/entities/data-import-mapping.entity.ts`
  - `src/modules/data-import/domain/entities/data-import-record.entity.ts`
  - `src/modules/data-import/domain/entities/data-import-source.entity.ts`
  - `src/modules/data-import/domain/entities/data-import-template.entity.ts`
  - `src/modules/data-import/domain/entities/data-import-approval.entity.ts`
  - `src/modules/data-import/domain/entities/data-import-execution.entity.ts`
  - `src/modules/data-import/domain/entities/data-import-audit-log.entity.ts`
  - `src/modules/data-import/domain/state-machine/import-state-machine.ts`
- **Database Changes**: Creation of tables (`data_imports`, `data_import_sources`, `data_import_mappings`, `data_import_templates`, `data_import_records`, `data_import_approvals`, `data_import_executions`, `data_import_audit_logs`).
- **API Changes**: None.
- **Frontend Changes**: None.
- **Tests**: Entity unit tests, state machine transition validity tests, database migration rollback tests.
- **Acceptance Criteria**: Migrations apply and rollback cleanly; state machine enforces all allowed and disallowed transitions.
- **Potential Risks**: Missing indexes on high-cardinality JSONB query paths.

---

## Phase 3: File Ingestion, Storage, Parsing & Normalization [COMPLETED]

- **Goal**: Implement secure multipart upload handlers, temporary storage, and parsers for CSV, Excel, JSON, and XML with normalized output contracts and safety bounds.
- **Prerequisites**: Phase 2 database models & foundation services.
- **Completed Deliverables**:
  1. `LocalFileStorageService` with path traversal defense, UUID storage keys, and SHA-256 integrity checksums.
  2. `FileSecurityValidator` with MIME/magic byte verification, Windows PE / Linux ELF executable blocking, and XXE injection defense.
  3. `CsvParser` with RFC 4180 compliance, deterministic delimiter autodetection (`,`, `;`, `\t`, `|`), UTF-8 BOM stripping, duplicate header disambiguation, and preview limits.
  4. `ExcelParser` (.xlsx, .xls) with multi-sheet discovery, worksheet selection, empty sheet handling, and scriptless formula reading.
  5. `JsonParser` with Array of Objects, NDJSON/JSONL, object wrapper extraction, and dot-notation flattening.
  6. `XmlParser` with repeating element extraction, XMLValidator syntax verification, and DOCTYPE/XXE blocking.
  7. `ParserFactory` and unified `IImportParser` contract producing standard `ParsedDataset`, `NormalizedHeader`, and `ParsedRow` records.
  8. REST API endpoints `POST /api/v1/data-imports/:id/upload` and `POST /api/v1/data-imports/:id/parse`.
  9. Comprehensive documentation in `DATA_IMPORT_FILE_INGESTION.md` and 80 automated unit/integration tests passing.
- **Files Implemented**:
  - `src/core/types/parser.types.ts`
  - `src/infrastructure/storage/file-storage.service.ts`
  - `src/infrastructure/security/file-security-validator.ts`
  - `src/infrastructure/parsers/csv.parser.ts`
  - `src/infrastructure/parsers/excel.parser.ts`
  - `src/infrastructure/parsers/json.parser.ts`
  - `src/infrastructure/parsers/xml.parser.ts`
  - `src/infrastructure/parsers/parser.factory.ts`
  - `src/domain/services/file-ingestion.service.ts`
  - `src/api/controllers/import.controller.ts`
  - `src/api/routes/import.routes.ts`
  - `DATA_IMPORT_FILE_INGESTION.md`
- **Tests**: 80 automated tests (16 suites) passing with 0 failures across CSV, Excel, JSON, XML, security, storage, state machine, and REST APIs.

---

## Phase 4: Entity Schema Registry & Column Mapping Engine [COMPLETED]

- **Goal**: Implement centralized entity schema registry, deterministic auto-mapping algorithms, manual mapping, validation engine, and mapping persistence.
- **Prerequisites**: Phase 2 database models & Phase 3 parser and staging services.
- **Completed Deliverables**:
  1. `EntitySchemaRegistry` with standard core entities (`contacts`, `products`, `invoices`), strongly typed field definitions, alias dictionaries, validation rules, constraints, and read-only flags.
  2. `ColumnNormalizer` for deterministic header normalization (snake_case conversion, token extraction, Levenshtein similarity) and sample type inference (`EMAIL`, `PHONE`, `BOOLEAN`, `NUMBER`, `DECIMAL`, `DATE`, `STRING`).
  3. `TypeCompatibilityEvaluator` evaluating source inferred types against target field types (`COMPATIBLE`, `TRANSFORM_REQUIRED`, `INCOMPATIBLE`, `UNKNOWN`).
  4. `DeterministicMappingSuggestionProvider` with multi-signal weighted scoring (exact, normalized, alias, label, token overlap, fuzzy string), conflict resolution, and ambiguity detection.
  5. `MappingValidatorService` validating structural integrity, required target fields, read-only field restrictions, duplicate target prevention, and type compatibility.
  6. `MappingService` orchestrating suggestion generation, persistence into `data_import_mappings`, lifecycle state transitions (`PARSED` → `MAPPING` → `MAPPED`), clearing mappings, and audit logging.
  7. REST APIs for entity discovery (`/entities`, `/entities/:entity`) and mapping lifecycle management (`/:id/mapping/suggestions`, `/:id/mapping`, `/:id/mapping/validate`).
  8. Comprehensive documentation in `DATA_IMPORT_MAPPING.md` and 117 automated unit and integration tests passing.
- **Files Implemented**:
  - `src/core/types/mapping.types.ts`
  - `src/core/registry/entity-schema.registry.ts`
  - `src/domain/mapping/column-normalizer.ts`
  - `src/domain/mapping/type-compatibility.evaluator.ts`
  - `src/domain/mapping/mapping-suggestion.provider.ts`
  - `src/domain/mapping/mapping-validator.service.ts`
  - `src/domain/services/mapping.service.ts`
  - `src/domain/repositories/data-import-mapping.repository.interface.ts`
  - `src/infrastructure/repositories/in-memory-data-import-mapping.repository.ts`
  - `src/api/controllers/import.controller.ts`
  - `src/api/routes/import.routes.ts`
  - `src/app.ts`
  - `DATA_IMPORT_MAPPING.md`
- **Tests**: 117 automated tests (23 suites) passing with 0 failures across Phase 2, Phase 3, and Phase 4.

---

## Phase 5: Transformation Pipeline & Multi-Tier Validation [COMPLETED]

- **Goal**: Implement deterministic cell transformations, reference lookups, and 4-tier validation with preview diffs.
- **Status**: **COMPLETED** (2026-09-23)
- **Delivered Deliverables**:
  1. `builtInTransformers` inventory (13 built-in transformers: `Trim`, `Lowercase`, `Uppercase`, `NullNormalize`, `ToString`, `ToNumber`, `ToDecimal`, `ToBoolean`, `ToDate`, `ToDateTime`, `PhoneFormat`, `PrefixSuffix`, `DefaultValue`).
  2. `TransformationRegistry` for safe, extensible registration of pure transformation functions.
  3. `TransformationPipeline` with bounded chain enforcement (`MAX_TRANSFORM_CHAIN_LENGTH = 10`), schema-driven type conversions, and localized error handling.
  4. Tier 2 Field Validators (`RequiredValidator`, `DataTypeValidator`, `EnumValidator`, `EmailValidator`, `PhoneValidator`, `StringConstraintValidator`, `NumericRangeValidator`).
  5. Tier 3 Cross-Field Validators (`DateRangeCrossFieldValidator` checking `issue_date` vs `due_date`, `start_date` vs `end_date`).
  6. Tier 4 Entity Business Validators (`ContactsBusinessValidator`, `ProductsBusinessValidator`, `InvoicesBusinessValidator`).
  7. `ValidationEngine` orchestrating multi-tier validation, assigning `RecordStatus.VALID` / `WARNING` / `INVALID`, and computing `ValidationSummary`.
  8. `DataImportRecordEntity` and `InMemoryDataImportRecordRepository` for persistence and paginated staged preview querying.
  9. `ValidationService` orchestrating validation execution, staging, state machine transitions (`MAPPED` → `VALIDATING` → `VALIDATED` / `VALIDATION_FAILED`), and immutable audit logs.
  10. REST API endpoints: `POST /api/v1/data-imports/:id/validate` and `GET /api/v1/data-imports/:id/validation-preview`.
  11. Comprehensive documentation in `DATA_IMPORT_TRANSFORMATION_VALIDATION.md`.
- **Files Implemented**:
  - `src/core/types/transformation.types.ts`
  - `src/core/types/validation.types.ts`
  - `src/domain/transformation/built-in.transformers.ts`
  - `src/domain/transformation/transformation.registry.ts`
  - `src/domain/transformation/transformation.pipeline.ts`
  - `src/domain/validation/field-validators.ts`
  - `src/domain/validation/cross-field.validators.ts`
  - `src/domain/validation/entity-validator.registry.ts`
  - `src/domain/validation/validation.engine.ts`
  - `src/domain/entities/data-import-record.entity.ts`
  - `src/domain/repositories/data-import-record.repository.interface.ts`
  - `src/infrastructure/repositories/in-memory-data-import-record.repository.ts`
  - `src/domain/services/validation.service.ts`
  - `src/api/controllers/import.controller.ts`
  - `src/api/routes/import.routes.ts`
  - `src/app.ts`
  - `DATA_IMPORT_TRANSFORMATION_VALIDATION.md`
- **Tests**: 159 automated tests (43 test suites) passing with 100% pass rate.

---

## Phase 6: Duplicate Detection Engine [COMPLETED]

- **Goal**: Implement detection of existing records via primary keys, business keys, and composite fields, with configurable resolution strategies.
- **Status**: **COMPLETED** (2026-09-23)
- **Delivered Deliverables**:
  1. `MatchKeyGenerator` generating deterministic canonical tokens with length-prefix encoding and SHA-256 cryptographic hashes, preventing composite key collisions (e.g. `["AB", "C"]` vs `["A", "BC"]`).
  2. Field-specific safe normalizations (case-insensitivity, email trimming/lowercasing, international phone formatting, explicit null/empty handling yielding `UNRESOLVED`).
  3. `DuplicateDetectionEngine` performing progressive 5-step classification: validation gate, match key computation, intra-file duplicate grouping with row preservation, batched target system lookups, and execution intent calculation (`CREATE`, `UPDATE`, `SKIP`, `REVIEW`, `BLOCKED`).
  4. Standardized record classifications (`NEW`, `EXISTING`, `DUPLICATE_IN_FILE`, `MULTIPLE_MATCH`, `CONFLICT`, `UNRESOLVED`, `INVALID`) and comprehensive `DuplicateSummary` metrics.
  5. `ITargetMatchProvider` abstraction and `InMemoryTargetMatchProvider` with strict multi-tenant isolation (`organizationId`) and batch lookup capabilities.
  6. `DataImportRecordEntity` staging persistence and `InMemoryDataImportRecordRepository` filtering by classification, execution intent action, duplicate flag, and blocked status.
  7. `DuplicateService` domain service orchestrating matching, staging persistence, and immutable audit logging.
  8. REST APIs: `POST /api/v1/data-imports/:id/detect-duplicates` and `GET /api/v1/data-imports/:id/match-preview`.
  9. Comprehensive documentation in `DATA_IMPORT_DUPLICATE_MATCHING.md` and 172 automated unit, integration, and security tests passing.
- **Files Implemented**:
  - `src/core/types/duplicate.types.ts`
  - `src/domain/duplicate/match-key.generator.ts`
  - `src/domain/duplicate/target-match-provider.interface.ts`
  - `src/infrastructure/matching/in-memory-target-match.provider.ts`
  - `src/domain/duplicate/duplicate-detection.engine.ts`
  - `src/domain/services/duplicate.service.ts`
  - `src/domain/entities/data-import-record.entity.ts`
  - `src/domain/repositories/data-import-record.repository.interface.ts`
  - `src/infrastructure/repositories/in-memory-data-import-record.repository.ts`
  - `src/api/validation/import.validation.ts`
  - `src/api/controllers/import.controller.ts`
  - `src/api/routes/import.routes.ts`
  - `src/app.ts`
  - `DATA_IMPORT_DUPLICATE_MATCHING.md`
- **Tests**: 172 automated tests (47 test suites) passing with 100% pass rate.

---

## Phase 7: Import Review, Approval & Batch Execution Engine [COMPLETED]

- **Goal**: Implement server-side readiness evaluation, multi-condition approval workflow with cryptographic state snapshotting, and transactional batch execution engine.
- **Status**: **COMPLETED** (2026-09-23)
- **Delivered Deliverables**:
  1. `ReviewService` with deterministic 8-point checklist verification (`FILE_PARSED`, `MAPPING_CONFIGURED`, `REQUIRED_FIELDS_MAPPED`, `VALIDATION_COMPLETED`, `NO_VALIDATION_ERRORS`, `DUPLICATE_DETECTION_COMPLETED`, `NO_BLOCKING_CONFLICTS`, `APPROVAL_SATISFIED`), overall readiness evaluation (`READY`, `NOT_READY`, `BLOCKED`), paginated review table, and single-record before/after comparisons.
  2. `ApprovalService` enforcing entity schema policies, separation of duties (preventing uploader self-approval), deterministic SHA-256 state snapshot hashing, and automatic invalidation upon upstream modifications.
  3. `ExecutionService` executing transactional batches (500 rows/batch), dispatching mutations to `ITargetMatchProvider` (`createRecord`, `updateRecord`, `deleteRecord`), enforcing idempotency, preventing concurrent execution runs, and handling partial failures (`CONTINUE_ON_ERROR` vs `ALL_OR_NOTHING`).
  4. Repositories: `IDataImportApprovalRepository` / `InMemoryDataImportApprovalRepository` and `IDataImportExecutionRepository` / `InMemoryDataImportExecutionRepository`.
  5. REST APIs: `GET /review`, `GET /review/records`, `GET /review/records/:recordId`, `POST /approve`, `POST /reject`, `POST /execute`, `GET /execution`, `GET /report`.
  6. Comprehensive documentation in `DATA_IMPORT_REVIEW_APPROVAL_EXECUTION.md` and 179 automated unit, integration, and security tests passing.
- **Files Implemented**:
  - `src/core/types/execution.types.ts`
  - `src/domain/services/approval.service.ts`
  - `src/domain/services/review.service.ts`
  - `src/domain/services/execution.service.ts`
  - `src/domain/repositories/data-import-approval.repository.interface.ts`
  - `src/infrastructure/repositories/in-memory-data-import-approval.repository.ts`
  - `src/domain/repositories/data-import-execution.repository.interface.ts`
  - `src/infrastructure/repositories/in-memory-data-import-execution.repository.ts`
  - `src/api/validation/import.validation.ts`
  - `src/api/controllers/import.controller.ts`
  - `src/api/routes/import.routes.ts`
  - `src/app.ts`
  - `DATA_IMPORT_REVIEW_APPROVAL_EXECUTION.md`
- **Tests**: 179 automated tests (51 test suites) passing with 100% pass rate.

---

## Phase 8: Post-Import Reconciliation, Reporting, Error Recovery & Hardening [COMPLETED]

- **Goal**: Implement post-execution reconciliation, 5-tier final reporting with drill-down traceability, controlled failed-record retries, orphan crash recovery, CSV formula injection defense, structured metrics, and data retention.
- **Status**: **COMPLETED** (2026-09-23)
- **Delivered Deliverables**:
  1. `ReconciliationService` implementing intended vs actual execution verification, mismatch detection (`INTENT_RESULT_MISMATCH`, `TARGET_ID_MISMATCH`), and deterministic completion rules (`COMPLETED`, `COMPLETED_WITH_ERRORS`, `RECONCILIATION_REQUIRED`).
  2. `ReportingService` compiling comprehensive 5-tier final reports (Metadata, Processing, Matching, Execution, Reconciliation, Performance, Failed Summary).
  3. `ReportingService.exportReport` and `exportFailedRecordsCsv` with **Formula Injection Defense** (automatically escaping `=`, `+`, `-`, `@`, `\t`, `\r` prefixes).
  4. `RetryService` executing safe, controlled retries for transient failed records with retry limit enforcement (max 3) and immutable attempt tracking.
  5. `RecoveryService` detecting and recovering orphaned import executions stuck in `PROCESSING` past timeout.
  6. `MetricsService` tracking operational counters and histograms (`imports_started`, `imports_completed`, `phase_duration_ms`).
  7. `CleanupService` executing tenant-safe data retention policies for temporary files while preserving immutable audit logs.
  8. REST APIs: `POST /reconcile`, `GET /report`, `GET /report/export`, `GET /failed-records`, `GET /failed-records/export`, `POST /retry`, `GET /health`, `GET /metrics`.
  9. Comprehensive documentation in `DATA_IMPORT_RECONCILIATION_REPORTING_HARDENING.md`.
- **Files Implemented**:
  - `src/core/types/reconciliation.types.ts`
  - `src/domain/entities/data-import-reconciliation.entity.ts`
  - `src/domain/repositories/data-import-reconciliation.repository.interface.ts`
  - `src/infrastructure/repositories/in-memory-data-import-reconciliation.repository.ts`
  - `src/domain/services/reconciliation.service.ts`
  - `src/domain/services/reporting.service.ts`
  - `src/domain/services/retry.service.ts`
  - `src/domain/services/recovery.service.ts`
  - `src/domain/services/metrics.service.ts`
  - `src/domain/services/cleanup.service.ts`
  - `src/api/validation/import.validation.ts`
  - `src/api/controllers/import.controller.ts`
  - `src/api/routes/import.routes.ts`
  - `src/app.ts`
  - `DATA_IMPORT_RECONCILIATION_REPORTING_HARDENING.md`
- **Tests**: Comprehensive unit and integration test suite passing with 100% success rate across all phases.

---

## Phase 9: Approvals, Auditing, History & Reporting

- **Goal**: Implement multi-condition approval workflow, cryptographic change invalidation, immutable audit trail, history views, and error report downloads.
- **Prerequisites**: Phase 7 execution engine and Phase 8 frontend foundation.
- **Tasks**:
  1. Implement `ApprovalService` with policy thresholds, decision endpoints, and SHA256 snapshot invalidation.
  2. Implement `AuditLoggingService` recording immutable events on all state changes.
  3. Implement `ReportGenerationService` exporting CSV/Excel error reports with cell-level remediation notes.
  4. Implement history querying with multi-criteria filtering, sorting, and pagination.
  5. Build Approvals and History views in the frontend.
- **Expected Files / Modules**:
  - `src/modules/data-import/services/approval.service.ts`
  - `src/modules/data-import/services/audit-log.service.ts`
  - `src/modules/data-import/services/report-generator.service.ts`
  - `src/modules/data-import/services/history.service.ts`
  - `frontend/src/components/approval/ApprovalQueue.tsx`
  - `frontend/src/components/history/HistoryTable.tsx`
- **Database Changes**: Records inserted into `data_import_approvals` and `data_import_audit_logs`.
- **API Changes**:
  - `POST /api/v1/data-imports/:id/approve`
  - `POST /api/v1/data-imports/:id/reject`
  - `GET /api/v1/data-imports/:id/report`
  - `GET /api/v1/data-imports/:id/audit-trail`
  - `GET /api/v1/data-imports/history`
- **Frontend Changes**: Approvals queue page, history table, and report download buttons.
- **Tests**: Anti-self-approval tests, cryptographic snapshot invalidation tests, report CSV generation tests.
- **Acceptance Criteria**: Editing mappings on an approved job immediately invalidates approval; audit trail records all events immutably.
- **Potential Risks**: Large export report generation causing worker memory spikes (mitigated by streaming CSV writer).

---

## Phase 10: AI Assistance & External Source Abstractions

- **Goal**: Implement optional LLM-assisted column mapping and error natural language explanations with graceful offline fallbacks, plus API/Webhook source adapters.
- **Prerequisites**: Phase 4 mapping, Phase 5 validation, and Phase 9 reporting.
- **Tasks**:
  1. Implement `AiAssistantService` with prompt sanitization (zero PII) and structured JSON output validation.
  2. Implement `RestApiSourceAdapter` with OAuth/Bearer auth, pagination, and rate-limit backoff.
  3. Implement `WebhookSourceAdapter` with HMAC signature validation.
  4. Integrate AI suggestion buttons into Frontend Mapping Studio and Error View.
- **Expected Files / Modules**:
  - `src/modules/data-import/ai/ai-assistant.service.ts`
  - `src/modules/data-import/adapters/rest-api.adapter.ts`
  - `src/modules/data-import/adapters/webhook.adapter.ts`
  - `frontend/src/components/ai/AiMappingSuggestionModal.tsx`
- **Database Changes**: Source connection records in `data_import_sources`.
- **API Changes**:
  - `POST /api/v1/data-imports/:id/ai-suggest-mapping`
  - `POST /api/v1/data-imports/:id/ai-explain-errors`
  - `POST /api/v1/data-imports/sources`
  - `POST /api/v1/data-imports/sources/:id/test-connection`
- **Frontend Changes**: AI Suggestion and Explanation UI components; Source Connection Manager.
- **Tests**: Mock LLM response tests, AI offline fallback tests, webhook signature validation tests.
- **Acceptance Criteria**: AI suggestions enhance mapping accuracy; system operates 100% normally when AI keys are absent or services offline.
- **Potential Risks**: LLM hallucinations in mapping (mitigated by strict schema validation against the Schema Registry).

---

## Phase 11: Comprehensive Test Suite & QA

- **Goal**: Build automated unit, integration, end-to-end (E2E), and negative test suites across all layers.
- **Prerequisites**: Phases 1–10 complete.
- **Tasks**:
  1. Implement comprehensive unit tests for all parsers, transformers, and validators.
  2. Implement integration tests covering full lifecycle state machine and tenant isolation.
  3. Implement E2E Cypress / Playwright tests for complete 9-step wizard workflow.
  4. Implement negative security test suite (CSV formula injection, XXE, zip bomb, cross-tenant leaks).
- **Expected Files / Modules**:
  - `tests/unit/**/*.spec.ts`
  - `tests/integration/**/*.spec.ts`
  - `tests/e2e/import-wizard.spec.ts`
  - `tests/security/malicious-payloads.spec.ts`
- **Database Changes**: None.
- **API Changes**: None.
- **Frontend Changes**: Test attributes (`data-testid`) added to components.
- **Tests**: Execution of all test suites.
- **Acceptance Criteria**: $>90\%$ code coverage on core engine modules; zero test regressions.
- **Potential Risks**: Flaky E2E tests due to asynchronous worker timing (mitigated by deterministic event polling in tests).

---

## Phase 12: Security, Performance & Production Hardening

- **Goal**: Implement rate limiting, Prometheus metrics, structured logging, database index tuning, and production deployment configuration.
- **Prerequisites**: Phase 11 test validation complete.
- **Tasks**:
  1. Configure API rate limiters and upload size throttles.
  2. Implement Prometheus metric exporters for duration, row throughput, and worker saturation.
  3. Conduct database query plan analysis (`EXPLAIN ANALYZE`) on large staging tables and add partial indexes where needed.
  4. Finalize Docker containerization, health check probes, and Helm/Kubernetes manifests.
- **Expected Files / Modules**:
  - `src/core/monitoring/metrics.service.ts`
  - `src/core/monitoring/structured-logger.ts`
  - `src/core/middleware/rate-limiter.middleware.ts`
  - `Dockerfile`
  - `docker-compose.yml`
  - `k8s/deployment.yaml`
- **Database Changes**: Final partial indexes on `data_import_records` for performance tuning.
- **API Changes**:
  - `GET /metrics` (Prometheus format)
  - `GET /health` (Liveness & readiness probe)
- **Frontend Changes**: Production build optimization.
- **Tests**: Load tests with 500,000-row imports, security penetration tests, metric scraping verification.
- **Acceptance Criteria**: Stable throughput $\ge 5,000$ rows/sec; Prometheus metrics exporting cleanly; sub-250ms API response times on paginated queries.
- **Potential Risks**: Unexpected database connection pool exhaustion under extreme concurrent worker load.
