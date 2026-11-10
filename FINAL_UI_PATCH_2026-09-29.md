# Final UI Patch — 2026-09-29

Changes in this patch:
- Removed visible page/browser scrollbars while preserving normal scrolling.
- Step 2 detected-columns area now displays only source column names; Inspect Column controls are no longer rendered there.
- Execution Step 8 no longer injects the duplicate global workflow KPI strip; the step-specific execution summary remains the single pre-execution dataset summary.
- Reconciliation Step 9 fills source/quality counters from the authoritative workflow snapshot when the reconciliation endpoint does not return those fields, preventing em-dashes for already-known values.
- Reconciliation variance uses the same authoritative source-row count.
