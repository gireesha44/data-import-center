# Final single-count UI patch — 2026-09-29

- Step 8: execution uses only execution metrics; no injected workflow KPI strip.
- Step 9: reconciliation uses only reconciliation metrics; no injected workflow KPI strip.
- Step 10: final report uses only the report-stat grid; no injected workflow KPI strip.
- Step 2: remains free of the cross-step KPI strip.
- The authoritative workflow statistics still synchronize step-specific values internally; this patch only removes redundant visual duplicates from Steps 8–10.
