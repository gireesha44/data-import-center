# Step 2 Parsed Dataset Count Fix — 2026-09-29

## Problem
After a CSV/XLSX/etc. file was successfully parsed, the Step 2 cross-step statistics strip could still show `Rows 0 / Columns 0` because it was rendered from the pre-parse import snapshot. Validation-dependent counters were also represented as numeric zero before validation had actually run.

## Fix
- Step 2 now immediately renders the parsed row and column counts from the parse response.
- The authoritative workflow summary is refreshed after the parse transaction is persisted.
- Before validation, Valid/Warnings/Invalid/Corrected are returned as `null` rather than misleading `0` values. The UI displays `—` for values that have not been evaluated yet.
- Once validation completes, the persisted validation snapshot becomes the source of truth and the real counts appear across all wizard steps.

Example after parsing the user's 06_mixed.csv:
- Rows: 18
- Columns: 4
- Valid/Warnings/Invalid/Corrected: — until validation runs

This keeps the distinction between `known zero` and `not evaluated yet`.
