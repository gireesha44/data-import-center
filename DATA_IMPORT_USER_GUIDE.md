# DATA IMPORT CENTRE — USER GUIDE

Welcome to the **Data Import Centre**. This guide walks you through importing your data safely and efficiently in 8 easy steps.

---

## The 8-Step Import Lifecycle

```text
1. Upload File ──► 2. Map Columns ──► 3. Validate & Review ──► 4. Resolve Duplicates
       ▲
       │
       ▼
5. Approve ──► 6. Execute ──► 7. Review Reconciliation ──► 8. Export Reports
```

---

### Step 1: Upload Source File
1. Navigate to **Data Import > New Import**.
2. Select your target entity type (e.g. `Customers`, `Invoices`, `Products`).
3. Drag & drop your file (`.csv`, `.xlsx`, `.json`, or `.xml`).
4. Click **Upload & Parse**. The system validates your file security, structure, and extracts column headers automatically.

---

### Step 2: Configure Column Mapping
1. The smart matching engine will suggest target fields automatically.
2. Review each source-to-target field mapping.
3. Apply any necessary transformations (e.g. `Trim Whitespace`, `Uppercase`, `Format Phone`, `Parse ISO Date`).
4. Ensure all required fields (marked with `*`) are mapped.
5. Click **Save Mapping & Validate**.

---

### Step 3: Validate & Review Data
1. The system validates all rows against schema rules, data types, and required formats.
2. Review the validation summary card:
   - **Valid Rows**: Green badge (Ready for import)
   - **Warnings**: Yellow badge (Non-blocking format adjustments)
   - **Errors**: Red badge (Must be fixed or skipped)
3. Filter by error code to inspect problem rows.

---

### Step 4: Duplicate Detection & Matching
1. The duplicate engine scans for intra-file duplicates and matches against existing target database records.
2. Review matched actions:
   - **CREATE**: New record will be inserted.
   - **UPDATE**: Existing target record will be updated.
   - **SKIP**: Record will not touch the database.
   - **CONFLICT**: Ambiguous match requiring manual selection.

---

### Step 5: Review & Approval
1. Run the **Automated Review Checklist**.
2. If all 8 governance checks pass, request approval.
3. In accordance with enterprise governance, an authorized approver reviews the frozen snapshot and signs off.

---

### Step 6: Execute Import
1. Click **Execute Import**.
2. Execution runs transactionally in resilient 500-record batches.
3. Monitor real-time progress indicators.

---

### Step 7: Post-Import Reconciliation
1. Once execution finishes, the post-import reconciliation engine automatically verifies that every row was written accurately to the target system.
2. Confirm the overall status: `COMPLETED` or `COMPLETED_WITH_ERRORS`.

---

### Step 8: Download Final Reports & Error Exports
1. Download the comprehensive **Import Summary Report**.
2. If any rows failed during execution, download the **Failed Records CSV** (which contains exact error reasons and is sanitized against spreadsheet formula injection).
3. If necessary, click **Retry Failed Records** to re-attempt transient network failures without duplicating existing data.
