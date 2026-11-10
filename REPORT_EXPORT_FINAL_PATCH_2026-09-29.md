# Final Report + Cleaned Data Export Patch — 2026-09-29

- Final Report UI separates **Cleaned Dataset** downloads from **Import Report Summary** downloads.
- Cleaned dataset: complete CSV and XLSX exports from the processed dataset.
- Import report: formatted PDF, DOCX, and CSV summary.
- Cleaned-dataset PDF/DOCX outputs are report-oriented summaries; CSV/XLSX are the full machine-readable dataset.
- PDF generation now uses the structured report renderer with a title banner, section headers, key/value tables, page footer and readable pagination.
