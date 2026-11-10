# Data Import Centre — UI / Validation State Patch (2026-09-29)

## Fixed

1. Removed duplicate top navigation markup and duplicate DOM IDs.
2. Made the enterprise header compact, responsive, and single-row at desktop widths.
3. Added authoritative validation-summary API and frontend consumption.
4. Validation headline counters now come from backend validation statistics, not paginated preview rows or initial zero placeholders.
5. Mapping/Mapped backend states can no longer open the Validation screen during draft resume.
6. Validation state is synchronized from backend state after validation/correction.
7. Added workflow metadata (`state`, `step`, `nextAllowedAction`, `canProceedToMatching`) to mapping/validation/matching responses.
8. Added role selector support for the eight documented business roles and removed the obsolete inline `onRoleChange` handler.
9. Added authorized department landing cards and department-aware dashboard/entity loading.
10. Department context is carried into new imports and restored when resuming an existing import.
11. Switching away from an active wizard now uses the existing Save-as-Draft guard rather than silently losing work.

## Verification

- `node --check public/app.js`: PASS
- `node --check` across generated backend `dist/*.js`: PASS
- Duplicate navigation IDs: none
- Undefined inline role-change handler: removed
- Validation summary endpoint is present in route/controller/service

## Environment limitation

A full runtime/browser screenshot test was not completed in this isolated environment because dependency installation and headless Chromium startup timed out. No claim of a full live E2E run is made here.
