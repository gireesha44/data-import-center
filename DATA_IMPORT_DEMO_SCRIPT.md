# DATA IMPORT CENTRE — DEMO SCRIPT

This step-by-step demo script allows a presenter or reviewer to walk through the entire 12-stage lifecycle of the Data Import Centre using standard REST API calls or curl / Postman commands.

---

## Demo Prerequisites
1. Start the Data Import Centre application:
   ```bash
   npm run dev
   ```
2. Set base URL: `http://127.0.0.1:3000/api/v1/data-imports`
3. Set standard demo headers:
   - Creator / Uploader:
     ```http
     x-organization-id: org-acme-demo
     x-user-id: user-demo-creator
     x-user-roles: operator,user
     x-user-permissions: DATA_IMPORT_CREATE,DATA_IMPORT_UPLOAD,DATA_IMPORT_MAP,DATA_IMPORT_VALIDATE,DATA_IMPORT_VIEW,DATA_IMPORT_EXECUTE,DATA_IMPORT_CANCEL
     ```
   - Lead Approver (for Segregation of Duties):
     ```http
     x-organization-id: org-acme-demo
     x-user-id: user-demo-approver
     x-user-roles: admin,lead
     x-user-permissions: DATA_IMPORT_VIEW,DATA_IMPORT_APPROVE,DATA_IMPORT_EXECUTE
     ```

---

## Step-by-Step Walkthrough

### Step 1: Discover Importable Entities
- **Action**: `GET /api/v1/data-imports/entities`
- **What Happens**: Returns registered entity schemas (`contacts`, `products`, `invoices`).
- **Reviewer Note**: Point out the centralized Schema Registry as the single source of truth.

---

### Step 2: Create a New Import
- **Action**: `POST /api/v1/data-imports`
  ```json
  {
    "name": "Acme Q3 Mixed Contacts Demo",
    "targetModule": "crm",
    "targetEntity": "contacts",
    "sourceType": "FILE_UPLOAD",
    "importOptions": { "duplicateStrategy": "UPDATE", "errorStrategy": "CONTINUE_ON_ERROR" }
  }
  ```
- **What Happens**: Returns `201 Created` with a new `importId` in `DRAFT` status.
- **Reviewer Note**: Point out multi-tenant isolation and initial draft state.

---

### Step 3: Upload Sample Mixed CSV
- **Action**: `POST /api/v1/data-imports/{importId}/upload`
  - Body contains Base64 payload of `demo-files/data-import-demo-mixed.csv`.
- **What Happens**: `FileSecurityValidator` validates magic bytes, computes SHA-256 checksum, transitions import to `UPLOADED`.
- **Reviewer Note**: Point out MIME spoofing protection and path traversal defense.

---

### Step 4: Parse File & Discover Headers
- **Action**: `POST /api/v1/data-imports/{importId}/parse`
- **What Happens**: Stream parser parses rows, disambiguates headers, infers types, transitions import to `PARSED`.
- **Reviewer Note**: Notice that duplicate headers and whitespace are normalized automatically.

---

### Step 5: Get AI / Deterministic Mapping Suggestions
- **Action**: `GET /api/v1/data-imports/{importId}/mapping/suggestions`
- **What Happens**: Returns field-to-field suggestions (e.g. `'First Name'` -> `'first_name'`).
- **Reviewer Note**: Notice the 1.0 confidence score and exact token matches.

---

### Step 6: Save Column Mapping
- **Action**: `POST /api/v1/data-imports/{importId}/mapping`
  ```json
  {
    "columnMappings": {
      "First Name": { "targetField": "first_name", "mappingMethod": "MANUAL", "enabled": true },
      "Last Name": { "targetField": "last_name", "mappingMethod": "MANUAL", "enabled": true },
      "Email Address": { "targetField": "email", "mappingMethod": "MANUAL", "enabled": true },
      "Phone Number": { "targetField": "phone", "mappingMethod": "MANUAL", "enabled": true }
    }
  }
  ```
- **What Happens**: Validates required schema fields, saves configuration, transitions to `MAPPED`.

---

### Step 7: Validate & Stage Records
- **Action**: `POST /api/v1/data-imports/{importId}/validate`
- **What Happens**: Runs 4-tier validation pipeline, flags invalid email (`not-a-valid-email`), stages records, transitions to `VALIDATED`.
- **Reviewer Note**: Notice that invalid rows are isolated and blocked without halting valid rows.

---

### Step 8: Duplicate Detection & Matching
- **Action**: `POST /api/v1/data-imports/{importId}/detect-duplicates`
- **What Happens**: Generates canonical token match keys, groups intra-file duplicates, matches existing target records, assigns actions (`CREATE`, `UPDATE`, `SKIP`).
- **Reviewer Note**: Show how length-prefixed composite keys prevent hash collision attacks.

---

### Step 9: Governance Review & Checklist
- **Action**: `GET /api/v1/data-imports/{importId}/review`
- **What Happens**: 8-point checklist confirms readiness and flags that formal approval is required.

---

### Step 10: Dual-Key Governance Approval
- **Action**: `POST /api/v1/data-imports/{importId}/approve` *(Using approver headers)*
  ```json
  { "decision": "APPROVE", "reason": "Demo dataset verified and approved" }
  ```
- **What Happens**: Computes SHA-256 snapshot hash, records approval receipt, transitions to `APPROVED`.
- **Reviewer Note**: Highlight segregation of duties (self-approval by creator is blocked).

---

### Step 11: Transactional Batch Execution
- **Action**: `POST /api/v1/data-imports/{importId}/execute`
- **What Happens**: Verifies snapshot hash, acquires lock, executes in 500-record batches, writes mutations to target provider, transitions to `EXECUTED`.
- **Reviewer Note**: Point out atomic batch execution and idempotency lock.

---

### Step 12: Post-Import Reconciliation & Final Report
- **Action**: `POST /api/v1/data-imports/{importId}/reconcile` then `GET /api/v1/data-imports/{importId}/report`
- **What Happens**: Row-by-row audit confirms all writes, returns 5-tier final report, transitions import to `COMPLETED`.
- **Reviewer Note**: Show that final report numbers match target database reality 100%.
