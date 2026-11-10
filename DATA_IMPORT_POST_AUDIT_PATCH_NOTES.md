# Data Import Centre — Post-Antigravity Audit & Patch Notes

Audit date: 2026-09-24

## Verification performed

- Inspected the project archive, documentation set, source tree, public UI, tests, package scripts, database migration, API routes/controllers, services, parsers, security middleware, and generated `dist`.
- Project inventory: 4,026 archive entries; 125 files under `src/`; 41 Markdown/Markdown-like documentation files.
- `npm run build`: PASS.
- `npm test`: PASS after fixes — 213/213 tests, 0 failures.
- `npm run test:integration`: PASS — 51/51 integration tests.
- `node --check public/app.js`: PASS.
- Manually exercised the new audit endpoint against a running app: PASS (200, real audit event returned).

## Bugs fixed in this patch

### 1. Frontend mapping request contract mismatch — FIXED
`public/app.js` was sending `{ mappings: [...] }`, while the backend Zod/API contract requires `{ columnMappings: { sourceColumn: {...} } }`.

This was the concrete cause of the documented/runtime `POST /api/v1/data-imports/:id/mapping` 400 validation failure.

The mapping validation and save calls now send the backend contract.

### 2. Windows filename traversal sanitization — FIXED
`LocalFileStorageService.sanitizeFilename()` used host-OS `path.basename()` before handling Windows separators. On Linux, `..\..\windows\system32\calc.exe` became `....windowssystem32calc.exe` instead of `calc.exe`.

The sanitizer now normalizes both `/` and `\` separators before extracting the final filename.

### 3. Storage path boundary check — HARDENED
`startsWith(basePath)` was replaced with `path.relative()` boundary validation to avoid prefix-collision path checks.

### 4. Synthetic audit UI — FIXED
The Audit Logs screen was displaying generated/synthetic audit entries instead of real audit data.

Added:
`GET /api/v1/data-imports/:id/audit`

The UI now loads the actual audit trail for the selected import.

### 5. Dashboard pending-approval calculation — FIXED
The UI previously counted `VALIDATED`/nonexistent `REVIEWED` states as pending approval. It now counts the actual lifecycle states:
`REQUIRES_APPROVAL` and `PENDING_APPROVAL`.

### 6. Resume workflow status mapping — FIXED
The frontend referenced `REVIEWED`, which is not an `ImportStatus` enum value. Resume handling now uses the actual lifecycle states and handles `COMPLETED_WITH_ERRORS`.

## Important remaining gaps found

These are NOT falsely marked as fixed because they require additional architecture/integration work:

1. Default persistence is in-memory. The PostgreSQL schema exists as a SQL migration, but no PostgreSQL repository/adapter is implemented in this archive.
2. No actual worker/queue implementation (BullMQ/Redis/etc.) exists. Execution is synchronous inside the HTTP request.
3. Recovery and cleanup services are instantiated but are not wired to a recurring scheduler/worker in `app.ts`.
4. The requirements matrix claims external API/webhook/internal database/scheduled sources, but the implementation primarily supports file upload and does not contain the corresponding source connector engine/routes/scheduler.
5. Mapping templates are documented as required, but no template CRUD service/routes/UI were found.
6. Import history filtering/deep history UI is not fully represented by the current static UI.
7. The backend security context middleware accepts caller-supplied organization/user/permission headers. This is appropriate only as a development/test adapter; real production authentication/authorization must come from the host Avyoma auth/API gateway.
8. The parser implementations load file contents into memory; the documentation's stronger streaming/large-scale architecture claims are not fully reflected in this standalone archive.
9. `maxRecordsCount` is configured but not enforced by the ingestion/parsing path.
10. Zip-bomb/SSRF defenses described in the requirements are not fully implemented as a complete source-processing security layer.
11. The archive's acceptance/handover documentation contains stronger "enterprise-grade/fully verified/production" claims than the actual standalone implementation can substantiate.

## Release assessment

The concrete mapping 400 bug is fixed and the current automated test suite is green.

However, this archive should NOT be represented as a fully production-integrated Avyoma module until the real host authentication, PostgreSQL persistence, target-entity integrations, worker/queue infrastructure, and the missing source/template/history capabilities are connected and verified.
