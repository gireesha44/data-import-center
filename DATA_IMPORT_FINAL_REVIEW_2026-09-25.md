# Data Import Centre — Final Documentation Alignment Review (2026-09-25)

## Source of truth
The supplied Data Import Centre specification and the module's supporting implementation documents were treated as authoritative.

## Changes applied
- Kept Target Entity selection in the destination stage before file upload.
- Added actual parsed-file metadata and sample-row rendering after upload/parse; mapping continues to use parsed source columns.
- Added configurable import options UI for batch size, header row, timezone, error strategy and duplicate handling.
- Corrected duplicate handling UI to use the backend-supported strategies: SKIP, UPDATE, REJECT and MANUAL_REVIEW.
- Corrected duplicate detection request payload to use `overrideStrategy` and persist the selected strategy before detection.
- Replaced the static four-item review checklist with the server-authoritative eight-point readiness checklist.
- Corrected review impact counters to use server fields for planned creates, updates and skips.
- Made approval actions permission-aware in the UI.
- Enforced role-to-permission boundaries in the backend development/test security adapter; caller-supplied permission headers are intersected with the caller's declared role permissions.
- Added role aliases for the documented `IMPORT_OPERATOR`, `IMPORT_APPROVER`, `IMPORT_REVIEWER`, and `DATA_MANAGER` archetypes.
- Kept System Administrator (`admin`) as a full-permission role, including approval, while preserving the separation-of-duties rule so an import creator cannot approve or reject their own import.
- Moved toast notifications to the top-right so they do not cover bottom-right wizard controls.
- Improved frontend API error extraction so structured backend errors display their actual message instead of `[object Object]`.
- Preserved public health/static UI routes while protecting Data Import API routes.

## Verification
- TypeScript build: PASS
- Frontend JavaScript syntax check: PASS
- Automated test suite: 213/213 PASS
- Manual RBAC smoke check: operator approval attempt returns 403; lead approval is accepted by RBAC and then correctly gated by import lifecycle state.

## Approval model
According to the access-control matrix, `admin` and `lead`/`manager` are authorized approvers. Approval is not available to an ordinary operator/user, and creator self-approval is blocked by separation of duties.

## Important integration note
The standalone package still uses the documented development/test header adapter and in-memory repositories. In the real Avyoma host, verified authentication, tenant context, persistent repositories/database migrations, and host RBAC must be injected through the existing application infrastructure. The package does not claim an external integration is functional unless implemented and tested.


## Post-review workflow correction
- Operators can reopen a `VALIDATION_FAILED` import in the Mapping stage and save corrected mappings/transformations without losing the existing draft/import id.
- Revalidation replaces stale staged-record outcomes so row-level results always correspond to the latest mapping/source.
- A recoverable pre-processing `FAILED` import can accept a replacement file; execution failures remain protected from source replacement.
- Duplicate matching is gated to `VALIDATED` imports only.
- Validation issues are rendered with their actual error code/message, and the wizard blocks progression to duplicate matching while invalid rows remain.
