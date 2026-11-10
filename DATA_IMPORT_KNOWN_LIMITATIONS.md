# DATA IMPORT CENTRE — KNOWN LIMITATIONS & OPERATIONAL BOUNDARIES

This document outlines the genuine operational boundaries, performance limits, workarounds, and recommended future roadmap enhancements for the Data Import Centre.

---

## 1. Known Limitations Matrix

| # | Limitation | Impact | Workaround | Recommended Roadmap Enhancement | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| 1 | **100MB File Ingestion Buffer** | Single files > 100MB cannot be ingested in a single multipart POST payload into Node.js buffer memory. | Compress large datasets into zip or split into 100MB batches. | Implement direct browser-to-S3 / GCS presigned multipart upload streaming. | Low |
| 2 | **Spreadsheet Formula Execution** | Excel formulas (`=SUM()`, `=A1*B1`) are not dynamically computed; they are ingested as raw string literals and sanitized on export. | Calculate calculated columns prior to export from source systems. | Add optional sandboxed formula calculation engine for trusted environments. | Low |
| 3 | **Segregation of Duties Single-Operator Mode** | In small development environments where only one user exists, the creator cannot self-approve without disabling anti-self-approval. | Create a second test user or set `ENFORCE_SEPARATION_OF_DUTIES=false` in environment configuration. | Add role-based bypass override for users with explicit `DATA_IMPORT_SUPERADMIN` role. | Medium |
| 4 | **In-Memory Repository Default** | Default configuration uses high-performance in-memory repositories for testing and development. | Configure `DATABASE_URL` pointing to PostgreSQL in staging and production. | Enable automated Prisma / TypeORM / Kysely migration runner on production startup. | High |
| 5 | **Synchronous HTTP Batch Execution** | Very large imports (e.g. 500,000 rows) executed via synchronous HTTP POST may encounter client socket timeouts if batch size exceeds network gateway limits. | Use default 500-record batch size or poll `/api/v1/data-imports/:id` for progress. | Introduce BullMQ / Redis-backed async background worker queue. | Medium |
