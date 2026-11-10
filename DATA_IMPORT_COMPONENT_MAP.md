# DATA IMPORT CENTRE — COMPONENT MAP

This document maps all core components, source files, and test files within the **Data Import Centre** codebase.

---

## 1. Directory Tree & Layer Organization

```text
data-import-center/
├── src/
│   ├── api/                                # Presentation & Transport Layer
│   │   ├── controllers/
│   │   │   └── import.controller.ts        # Primary REST Controller (16 endpoints)
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts          # Security context & RBAC guards
│   │   │   └── error.middleware.ts         # Global API error handler & error taxonomy
│   │   ├── routes/
│   │   │   └── import.routes.ts            # Express Router definitions with Multer
│   │   └── validation/
│   │       └── import.validation.ts        # Zod request payload schemas
│   │
│   ├── core/                               # Cross-Cutting Core & Config
│   │   ├── config/
│   │   │   └── import.config.ts            # Centralized runtime limits & options
│   │   ├── errors/
│   │   │   └── import.errors.ts            # BaseImportError hierarchy & domain errors
│   │   ├── logging/
│   │   │   └── structured-logger.ts        # JSON structured logger with secret masking
│   │   ├── registry/
│   │   │   └── entity-schema.registry.ts   # Single source of truth schema registry
│   │   └── types/
│   │       ├── duplicate.types.ts          # Duplicate & match key interfaces
│   │       ├── import.types.ts             # Status enums, DataImport record types
│   │       ├── mapping.types.ts            # Column mapping & rule definitions
│   │       ├── permissions.types.ts        # RBAC roles & permission flags
│   │       ├── reconciliation.types.ts     # Reconciliation status & discrepancies
│   │       ├── review-approval.types.ts    # Review checklist & approval entities
│   │       └── validation.types.ts         # Multi-tier validation error types
│   │
│   ├── domain/                             # Business Logic & Pure Domain Engines
│   │   ├── duplicate/
│   │   │   ├── duplicate-detection.engine.ts # Canonical token generator & match algorithms
│   │   │   ├── match-key.generator.ts        # Length-prefixed composite key generator
│   │   │   └── target-match-provider.interface.ts # Target lookup provider interface
│   │   ├── entities/
│   │   │   ├── data-import.entity.ts         # DataImport aggregate root entity
│   │   │   ├── data-import-approval.entity.ts # Governance approval snapshot entity
│   │   │   ├── data-import-execution.entity.ts # Batch execution entity
│   │   │   ├── data-import-mapping.entity.ts # Stored mapping configuration entity
│   │   │   ├── data-import-reconciliation.entity.ts # Post-import reconciliation entity
│   │   │   └── data-import-record.entity.ts  # Staged row record entity
│   │   ├── mapping/
│   │   │   ├── column-normalizer.ts          # Header cleaner, tokenizer, type inferrer
│   │   │   ├── mapping-suggestion.provider.ts # Deterministic fuzzy & alias suggestion engine
│   │   │   ├── mapping-validator.service.ts  # Required field & completeness validator
│   │   │   └── type-compatibility.evaluator.ts # Type coercion compatibility matrix
│   │   ├── repositories/
│   │   │   ├── data-import.repository.interface.ts
│   │   │   ├── data-import-approval.repository.interface.ts
│   │   │   ├── data-import-execution.repository.interface.ts
│   │   │   ├── data-import-mapping.repository.interface.ts
│   │   │   ├── data-import-reconciliation.repository.interface.ts
│   │   │   └── data-import-record.repository.interface.ts
│   │   ├── services/
│   │   │   ├── approval.service.ts         # Dual-key approval & SHA-256 snapshot hashing
│   │   │   ├── audit.service.interface.ts  # Audit recorder abstraction
│   │   │   ├── cleanup.service.ts          # Retention sweeper & temporary file purger
│   │   │   ├── duplicate.service.ts        # Deduplication & target match orchestrator
│   │   │   ├── execution.service.ts        # Transactional 500-record batch execution engine
│   │   │   ├── file-ingestion.service.ts   # Parser router & file stage manager
│   │   │   ├── import.service.ts           # Import CRUD & lifecycle manager
│   │   │   ├── mapping.service.ts          # Column mapping domain service
│   │   │   ├── metrics.service.ts          # Prometheus counter & duration histogram tracker
│   │   │   ├── reconciliation.service.ts   # Row-by-row intended vs actual write auditor
│   │   │   ├── recovery.service.ts         # Stalled / orphaned job recovery sweeper
│   │   │   ├── reporting.service.ts        # 5-tier reporting & safe CSV export engine
│   │   │   ├── retry.service.ts            # Selective retry engine (max 3 attempts)
│   │   │   ├── review.service.ts           # 8-point automated pre-approval checklist
│   │   │   └── validation.service.ts       # Multi-tier validation orchestrator
│   │   ├── state-machine/
│   │   │   └── import-state-machine.ts     # 20-state deterministic finite state machine
│   │   ├── transformers/
│   │   │   ├── builtin-transformers.ts     # 13 pure deterministic data transformers
│   │   │   └── transformation-pipeline.ts  # Ordered transformation pipeline
│   │   └── validation/
│   │       ├── cross-field.validator.ts    # Tier 3 cross-field rule evaluator
│   │       ├── field-validators.ts         # Tier 2 data type, regex, email, range validators
│   │       └── validation-engine.ts        # Tier 1-4 multi-tier validation engine
│   │
│   ├── infrastructure/                     # External Adapters & Implementation
│   │   ├── database/
│   │   │   └── migrations/
│   │   │       └── 001_create_data_import_schema.sql # Complete PostgreSQL schema with RLS
│   │   ├── matching/
│   │   │   └── in-memory-target-match.provider.ts # In-memory target lookup provider
│   │   ├── parsers/
│   │   │   ├── base.parser.ts              # Abstract stream parser definition
│   │   │   ├── csv.parser.ts               # RFC 4180 CSV parser with delimiter detection
│   │   │   ├── excel.parser.ts             # SheetJS-based XLSX/XLS parser
│   │   │   ├── json.parser.ts              # Fast JSON array/object parser
│   │   │   └── xml.parser.ts               # Fast-XML-Parser with XXE neutralization
│   │   ├── repositories/
│   │   │   ├── in-memory-audit.repository.ts
│   │   │   ├── in-memory-data-import.repository.ts
│   │   │   ├── in-memory-data-import-approval.repository.ts
│   │   │   ├── in-memory-data-import-execution.repository.ts
│   │   │   ├── in-memory-data-import-mapping.repository.ts
│   │   │   ├── in-memory-data-import-reconciliation.repository.ts
│   │   │   └── in-memory-data-import-record.repository.ts
│   │   ├── security/
│   │   │   └── file-security-validator.ts  # Magic bytes, MIME spoofing & zip bomb defense
│   │   ├── services/
│   │   │   └── audit.service.ts            # Structured JSON audit event recorder
│   │   └── storage/
│   │       ├── file-storage.service.ts     # Storage interface abstraction
│   │       └── local-file-storage.service.ts # Local temporary staging with path defense
│   │
│   ├── tests/                              # Automated Test Suite (213 tests / 57 suites)
│   │   ├── integration/
│   │   │   ├── audit-trail.test.ts         # Audit immutability integration tests
│   │   │   ├── e2e-lifecycle.test.ts       # Complete 12-stage end-to-end integration test
│   │   │   ├── file-ingestion-api.test.ts  # File upload & parsing integration tests
│   │   │   ├── mapping-api.test.ts         # Column mapping HTTP API tests
│   │   │   ├── phase9-scenarios.test.ts    # Comprehensive 21-scenario integration suite
│   │   │   ├── reconciliation-reporting-api.test.ts # Reconciliation & export tests
│   │   │   └── review-approval-execution-api.test.ts # Governance & execution API tests
│   │   └── unit/                           # 50 unit test suites covering all services,
│   │                                       # parsers, validators, transformers, state machine
│   ├── app.ts                              # Express Application Factory & Dependency Injector
│   └── index.ts                            # HTTP Server Entrypoint
```
