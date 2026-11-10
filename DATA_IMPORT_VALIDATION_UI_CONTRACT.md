# Data Import Centre — Validation UI Contract

## Authoritative counts

The validation screen must never initialize final counters to `0` after an import has been parsed.
Use the backend values from either:

- `GET /data-imports/:id/validation-summary`
- `GET /data-imports/:id/validation-preview` → `meta.validation`
- `POST /data-imports/:id/validate` → `data` + `data.workflow`

The backend returns:

- `totalRows`
- `validRows`
- `warningRows`
- `invalidRows`
- `errorCount`
- `warningCount`
- `fieldIssueCounts`
- `issuesByCode`
- `durationMs`

## State synchronization

The UI must render the wizard step from `workflow.state`/`workflow.step`, not from a local optimistic step alone.
For example, after validation succeeds the backend returns `VALIDATED`, and the UI must not continue displaying `MAPPING`.

`canProceedToMatching` is true only when the backend state is `VALIDATED`.

## Top navigation

The supplied ZIP is the Data Import Centre backend/domain package and does not contain the frontend source files that render the navigation bar. Therefore the screenshot's duplicated/cluttered top navigation cannot be safely edited in this ZIP. The frontend project containing the nav/layout component must be supplied for that visual fix.

Recommended UI structure: one compact primary navigation row with the product name, active module breadcrumb, primary pages (Dashboard, Import Studio, Entity Schemas, Audit Logs), then tenant and role controls. Do not render the same navigation set twice.
