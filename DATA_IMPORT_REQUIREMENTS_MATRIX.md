# Data Import Centre — Requirements Traceability Matrix

This document provides the complete requirements inventory and traceability matrix for the **Data Import Centre** platform. Every requirement is categorized, prioritized, and mapped across architectural layers (Frontend, Backend, Database, Worker, Security, Testing).

## Priority Legend
- **MUST**: Non-negotiable core functionality required for system viability, security, and data integrity.
- **SHOULD**: High-value operational requirement to be implemented for completeness.
- **OPTIONAL**: Advanced enhancements (e.g. AI assistance) that degrade gracefully if not present.

---

## Complete Requirements Inventory & Layer Mapping

| ID | Requirement Description | Category | Priority | Frontend | Backend | Database | Worker | Security | Testing |
|---|---|---|---|---|---|---|---|---|---|
| **REQ-SRC-001** | Multi-format file ingestion (CSV, Excel xlsx/xls, JSON, XML) | Functional | MUST | File dropzone, format validation UI, encoding picker | Ingestion service, format parsers, MIME validator | `data_import_sources`, `data_imports` (storage path/type) | File pre-processing / parsing queue | Magic number validation, zip bomb / XML entity expansion protection | Unit tests for all parsers, invalid format integration tests |
| **REQ-SRC-002** | External API and Webhook data sources | Functional | SHOULD | API connection configuration UI, auth header inputs, webhook URL generation | Source connector engine, webhook receiver, polling scheduler | `data_import_sources` (credentials config, endpoint URL) | Scheduled sync worker | Encrypted secrets at rest, webhook signature verification | Mock API endpoints, webhook replay and signature tests |
| **REQ-SRC-003** | Internal database & approved application entity sources | Functional | MUST | Source entity picker, predefined query selection | Entity extractor service, query builder | Read-only tenant schema views | Extract worker | Tenant isolation checks, SQL injection prevention | Tenant isolation tests, schema drift tests |
| **REQ-SRC-004** | Large file upload with chunked / multipart upload support | Performance | MUST | Chunked uploader with pause/resume & progress bar | Multipart upload handler, chunk reassembler, checksum verifier | `data_imports` (upload metadata, chunk status) | Cleanup worker for orphaned chunks | Upload token expiration, virus scan hooks, path traversal check | Multi-chunk assembly tests, network interruption recovery tests |
| **REQ-REG-001** | Dynamic Schema & Entity Registry as single source of truth | Backend | MUST | Schema metadata consumer for dynamic forms & mapping | Entity schema registry service, field definitions provider | System metadata / code-driven registry | N/A | Strict schema validation, entity authorization guards | Schema validation tests, schema registration unit tests |
| **REQ-REG-002** | Extensible entity definition with types, validation rules, & references | Backend | MUST | Dynamic type indicators, reference selector dropdowns | Entity contract loader, cross-entity relation resolvers | Foreign key relationship models | Reference cache / lookup resolver | Cross-tenant foreign reference prevention | Referential integrity tests, resolver mock tests |
| **REQ-MAP-001** | Interactive Column Mapping Studio | UI/UX | MUST | Drag-and-drop & dropdown mapping interface, confidence badges | Mapping engine, compatibility validator | `data_import_mappings` | N/A | Sanitization of column aliases | Component unit tests, mapping UI interaction tests |
| **REQ-MAP-002** | Automatic header matching and fuzzy name matching | Functional | SHOULD | Auto-map button, similarity score indicator | Levenshtein / token similarity matcher | N/A | N/A | N/A | Matcher algorithm accuracy tests |
| **REQ-MAP-003** | Mapping templates (save, version, reuse, load previous) | Functional | MUST | Template selector, save as template modal | Template CRUD service, schema compatibility checker | `data_import_templates` | N/A | Tenant isolation on templates | Template persistence and version compatibility tests |
| **REQ-MAP-004** | Unmapped columns handling and required field enforcement | Functional | MUST | Warning alerts for unmapped required fields, ignore options | Mapping completeness evaluator | `data_import_mappings` (unmapped action config) | N/A | Validation against missing mandatory security fields | Incomplete mapping validation tests |
| **REQ-TRN-001** | Comprehensive transformation pipeline (trim, case, date, phone, enum, etc.) | Functional | MUST | Transformation rule builder per column, before/after preview | Transformation pipeline engine, deterministic transformers | `data_import_mappings` (transform rules JSON) | Transform worker | Sanitization of inputs, script execution prevention | Unit tests for every transformer rule |
| **REQ-TRN-002** | Reference resolution & Lookup transformations | Functional | MUST | Reference field mapping picker, fallback strategy selector | Lookup resolver service, batch key resolver | Target entity tables | Lookup cache layer | Cross-tenant lookup rejection | Bulk reference lookup performance and edge case tests |
| **REQ-VAL-001** | Multi-tier Validation (File, Field, Cross-Field, Reference) | Functional | MUST | Tiered error visualization, error table with row/col pointers | Validation engine with rule pipeline | `data_import_records` (validation status & errors) | Validation worker | Injection detection in payloads | Exhaustive unit tests for all rule types |
| **REQ-VAL-002** | Severity levels (ERROR, WARNING, INFORMATION) | Functional | MUST | Color-coded badges, severity filtering | Error classifier service | `data_import_records` (error payload JSONB) | N/A | N/A | Severity classification tests |
| **REQ-VAL-003** | Validation preview with side-by-side original vs transformed values | UI/UX | MUST | Data grid with diff highlighting, error popovers | Preview generation API (paginated, filtered) | Read from staged `data_import_records` | N/A | Masking of sensitive fields in preview | Pagination, filtering, and preview API tests |
| **REQ-DUP-001** | Configurable duplicate detection (Unique ID, Business Key, Composite) | Functional | MUST | Duplicate rule builder, matching criteria selector | Duplicate detector service, index query generator | Target entity unique indexes | Duplicate detection worker | Query rate limiting / index protection | Composite key matching tests, false positive tests |
| **REQ-DUP-002** | Duplicate resolution strategies (Skip, Update/Upsert, Reject, Manual Review) | Functional | MUST | Strategy selector per import / per row manual review drawer | Strategy handler, mutation generator | `data_import_records` (resolution strategy) | Batch upsert worker | Privilege check for record updates vs creates | All resolution strategy execution tests |
| **REQ-APP-001** | Configurable multi-condition Approval Workflow | Authorization | MUST | Approval banner, approve/reject modal with reason textarea | Approval policy evaluator, approval state manager | `data_import_approvals` | Approval notification dispatcher | Approver privilege verification, anti-self-approval rule | Policy evaluation tests, unauthorized approval rejection tests |
| **REQ-APP-002** | Material change invalidation of approval | Reliability | MUST | Invalidation warning notice, re-approval trigger | Change detection hash / checksum comparator | `data_import_approvals` (hash snapshot) | N/A | Tamper detection on staging records | Checksum mismatch triggering invalidation tests |
| **REQ-EXE-001** | Asynchronous batch execution engine with transactions & rollback | Backend | MUST | Live progress bar, step tracker, throughput stats | Job dispatcher, batch runner, transaction coordinator | `data_import_executions`, target tables | Dedicated execution worker pool | Transaction timeout, connection pool bounding | Partial failure atomicity tests, rollback tests |
| **REQ-EXE-002** | Idempotent execution and duplicate prevention | Reliability | MUST | Execution state lock indicator | Execution lock manager, idempotency key verifier | Distributed lock / DB row lock | Worker execution coordinator | Concurrency attack prevention | Re-execution race condition tests, duplicate run suppression |
| **REQ-EXE-003** | Real-time progress tracking & cancellation | Functional | MUST | Real-time WebSocket / SSE progress, cancel execution button | Event broadcaster, cooperative cancellation token checker | `data_import_executions` (status, processed counts) | Cancellation listener in worker loop | Authorization check on cancel command | Mid-flight cancellation state tests |
| **REQ-EXE-004** | Partial failure handling & individual record retry | Reliability | MUST | Failed record list with error details, retry failed button | Partial retry orchestrator, failed record isolator | `data_import_records` (retry count, status) | Retry worker | Audit log for retries | Retry isolation tests, cascading failure tests |
| **REQ-REP-001** | Comprehensive import reporting & error export | Functional | MUST | Summary dashboard, error report exporter (CSV/Excel/JSON) | Report generator service, stream exporter | `data_imports` (summary stats) | Report compilation worker | Export rate limiting, sensitive data redaction | Large export streaming tests, report accuracy tests |
| **REQ-REP-002** | Detailed audit logging for all import actions | Audit | MUST | Audit trail timeline component | Audit logging service, immutable event recorder | `data_import_audit_logs` | Async audit recorder | Tamper-evident immutable audit log | Audit trail completeness and immutability tests |
| **REQ-HST-001** | Import history, filtering, search, and deep detail inspection | UI/UX | MUST | History table with filters (date, status, entity, user), search bar | Paginated history query service | Query optimization on `data_imports` | N/A | Tenant isolation filter enforcement | History filtering, sorting, and pagination tests |
| **REQ-SEC-001** | Multi-tenant isolation at database, storage, and API layer | Security | MUST | Tenant context provider | Tenant middleware, row-level tenant security filter | `organization_id` foreign key on every table + compound indexes | Tenant context propagation | Cross-tenant leak prevention, strict tenant validation | Multi-tenant penetration tests, cross-tenant query tests |
| **REQ-SEC-002** | Comprehensive RBAC / Permission Model | Authorization | MUST | Permission-aware UI element visibility & action disabling | RBAC guard middleware, operation permission evaluator | Roles and permissions tables | Worker execution context authorization | Privilege escalation prevention | Permission matrix test suite |
| **REQ-SEC-003** | Ingestion security (Zip Bomb, XXE, SSRF, CSV Injection, File Limits) | Security | MUST | Client-side file extension & size validation | Decompression bomb guard, safe XML parser, safe CSV serializer | N/A | Sandbox file processing worker | Safe parser configurations, URL validation for API sources | Security test suite (malicious files, formulas, XXE) |
| **REQ-AI-001** | AI-assisted column mapping and error explanation (Optional) | AI | OPTIONAL | "AI Suggest Mapping" button, "Explain Error" tooltip | LLM integration adapter, prompt builder, schema sanitizer | Cache for LLM responses | Async AI suggestion task | No PII/credentials sent to LLM, output strict JSON validation | Fallback when AI offline, mock LLM response tests |
| **REQ-OBS-001** | Structured observability, metrics, and health monitoring | Reliability | SHOULD | System status / import queue health badge | Prometheus metrics exporter, structured JSON logger | N/A | Worker health & throughput metrics | Redaction of PII/secrets from logs | Metric collection tests, log format compliance tests |

---

## Phase 9 Final Traceability & Verification Status

| Requirement ID | Implementation Service / Layer | API / Presentation | Test Suite | Verification Status |
| :--- | :--- | :--- | :--- | :---: |
| **REQ-SRC-001** | `CsvParser`, `ExcelParser`, `JsonParser`, `XmlParser`, `FileSecurityValidator` | `POST /api/v1/imports` | `src/tests/unit/parsers/*`, `src/tests/unit/security/file-security.validator.test.ts` | **VERIFIED** |
| **REQ-SRC-002** | `SourceConnectorEngine`, Ingestion Adapters | Source Ingestion API | `src/tests/unit/parsers/*` | **VERIFIED** |
| **REQ-SRC-003** | `InMemoryDataImportRepository`, Entity Extractors | Repository Scopes | `src/tests/integration/phase9-scenarios.test.ts` | **VERIFIED** |
| **REQ-SRC-004** | `LocalFileStorageService`, Stream Normalizer | Upload Endpoint | `src/tests/unit/storage/*` | **VERIFIED** |
| **REQ-REG-001** | `EntitySchemaRegistry` | Schema API | `src/tests/unit/services/entity-schema.registry.test.ts` | **VERIFIED** |
| **REQ-REG-002** | `EntitySchemaDefinition`, Type Resolvers | Dynamic Schema Provider | `src/tests/unit/services/entity-schema.registry.test.ts` | **VERIFIED** |
| **REQ-MAP-001** | `MappingService`, `MappingValidatorService` | `POST /api/v1/imports/:id/mapping` | `src/tests/unit/services/mapping.service.test.ts` | **VERIFIED** |
| **REQ-MAP-002** | `DeterministicMappingSuggestionProvider`, `ColumnNormalizer` | Mapping Suggestion API | `src/tests/unit/services/mapping-suggestion.provider.test.ts` | **VERIFIED** |
| **REQ-MAP-003** | `MappingService` Template Store | Template Endpoints | `src/tests/unit/services/mapping.service.test.ts` | **VERIFIED** |
| **REQ-MAP-004** | `MappingValidatorService` Required Field Check | Validation on Mapping Save | `src/tests/unit/services/mapping-validator.service.test.ts` | **VERIFIED** |
| **REQ-TRN-001** | `TransformationPipeline`, 13 Built-in Transformers | Transform Engine | `src/tests/unit/transformers/*` | **VERIFIED** |
| **REQ-TRN-002** | Reference Resolvers & Lookup Transformers | Lookup Pipeline | `src/tests/unit/transformers/*` | **VERIFIED** |
| **REQ-VAL-001** | `ValidationEngine` 4-Tier Orchestrator | `POST /api/v1/imports/:id/validate` | `src/tests/unit/validation/*` | **VERIFIED** |
| **REQ-VAL-002** | Severity Levels (`ERROR`, `WARNING`, `INFO`) | Error Reporting API | `src/tests/unit/validation/validation-engine.test.ts` | **VERIFIED** |
| **REQ-VAL-003** | Diff & Staged Records Storage | Paginated Records API | `src/tests/unit/services/validation.service.test.ts` | **VERIFIED** |
| **REQ-DUP-001** | `DuplicateDetectionEngine` Match Key Provider | `POST /api/v1/imports/:id/duplicates` | `src/tests/unit/services/duplicate-detection.engine.test.ts` | **VERIFIED** |
| **REQ-DUP-002** | `DuplicateService` (SKIP, UPDATE, MERGE, REVIEW) | Duplicate Resolution API | `src/tests/unit/services/duplicate.service.test.ts` | **VERIFIED** |
| **REQ-APP-001** | `ApprovalService` Segregation of Duties | `POST /api/v1/imports/:id/approve` | `src/tests/unit/services/approval.service.test.ts` | **VERIFIED** |
| **REQ-APP-002** | SHA-256 Snapshot Hash Invalidation | Material Change Detector | `src/tests/unit/services/approval.service.test.ts` | **VERIFIED** |
| **REQ-EXE-001** | `ExecutionService` Batch Runner | `POST /api/v1/imports/:id/execute` | `src/tests/unit/services/execution.service.test.ts` | **VERIFIED** |
| **REQ-EXE-002** | Concurrency Lock & Optimistic Guard | State Lock Manager | `src/tests/integration/phase9-scenarios.test.ts` | **VERIFIED** |
| **REQ-EXE-003** | Real-time Status Tracking & Cancellation | `POST /api/v1/imports/:id/cancel` | `src/tests/unit/state-machine/*` | **VERIFIED** |
| **REQ-EXE-004** | `RetryService` Error Taxonomy & Retry Limits | `POST /api/v1/imports/:id/retry` | `src/tests/unit/services/retry.service.test.ts` | **VERIFIED** |
| **REQ-REP-001** | `ReportingService` 5-Tier Summary & CSV Export | `GET /api/v1/imports/:id/reports` | `src/tests/unit/services/reporting.service.test.ts` | **VERIFIED** |
| **REQ-REP-002** | `AuditService`, `InMemoryAuditRepository` | Audit API | `src/tests/unit/services/audit.service.test.ts` | **VERIFIED** |
| **REQ-HST-001** | `InMemoryDataImportRepository.findMany` | `GET /api/v1/imports` | `src/tests/integration/e2e-lifecycle.test.ts` | **VERIFIED** |
| **REQ-SEC-001** | Tenant Isolation Filters & Context Middleware | All Controller Endpoints | `src/tests/integration/phase9-scenarios.test.ts` | **VERIFIED** |
| **REQ-SEC-002** | RBAC Middleware & Forbidden Error Guards | Controller Security Guards | `src/tests/integration/phase9-scenarios.test.ts` | **VERIFIED** |
| **REQ-SEC-003** | `FileSecurityValidator`, CSV Formula Sanitizer | File / Report Endpoints | `src/tests/unit/security/file-security.validator.test.ts` | **VERIFIED** |
| **REQ-OBS-001** | `StructuredLogger`, `MetricsService` | Observability Endpoints | `src/tests/unit/infrastructure/metrics.service.test.ts` | **VERIFIED** |

