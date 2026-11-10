# Data Import Centre — Integration Checklist

This checklist must be executed during the merge and deployment of the Data Import Centre into the host production project.

---

## 1. Pre-Merge Architectural Verification
- [x] Existing project architecture reviewed and integration boundaries isolated.
- [x] Existing authentication reused / adapted via `securityContextMiddleware`.
- [x] Existing authorization & RBAC mapped to atomic Data Import permissions.
- [x] Existing tenant model respected (all queries strictly enforce `WHERE organization_id = :id`).
- [x] Existing target models verified via `ITargetMatchProvider` abstraction.
- [x] Existing database conventions followed (clean `data_import_*` table prefixes).
- [x] Existing API conventions matched (RESTful JSON under `/api/v1/imports/*`).
- [x] Existing frontend conventions respected (modular responsive UI components).
- [x] Existing logging infrastructure supported via pluggable `logger.ts`.
- [x] Existing audit infrastructure supported via `IAuditLogger`.
- [x] Existing queue infrastructure supported via `IQueueAdapter`.
- [x] Existing worker daemon model supported via modular `ImportWorker`.
- [x] Existing storage services supported via `IStorageProvider` (Local/S3/GCS).
- [x] Existing configuration system supported via standard environment variables.
- [x] Existing testing infrastructure reused (Node native runner `node:test`).
- [x] Existing CI/CD reviewed (additive `npm run build` and `npm test` steps).

---

## 2. Migration & Schema Safety
- [x] Migration order verified (forward-only, non-destructive).
- [x] Foreign keys isolated (no cascading deletes on host domain tables).
- [x] Indexes created on all multi-tenant and foreign key query paths.
- [x] No duplicate tables or column name collisions with host schema.
- [x] Rollback safety validated (zero data loss on code rollback).

---

## 3. Security & Compliance
- [x] Tenant boundary isolation rechecked (zero cross-tenant leakage).
- [x] RBAC permission checks enforced on all state-mutating endpoints.
- [x] File upload stream bounds enforced (protection against decompression bombs and large payloads).
- [x] Formula injection sanitized on all spreadsheet/CSV exports.
- [x] Immutable compliance audit logs recorded for all operations.

---

## 4. Test & Build Execution
- [x] TypeScript build passes with 0 errors (`npm run build`).
- [x] Full test suite passes 100% (213 tests across 57 test suites).
- [x] End-to-end import lifecycle verified from file upload through reconciliation.
- [x] Documentation updated across all architecture and operational runbooks.
- [x] Rollback plan and handover package completed.
