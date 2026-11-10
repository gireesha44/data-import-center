# DATA IMPORT CENTRE — REST API REFERENCE

All endpoints are scoped under `/api/v1/data-imports`. All requests require tenant context (`x-organization-id`) and user authentication headers (`x-user-id`, `x-user-roles`, `x-user-permissions`).

---

## 1. Authentication & Security Headers

| Header Name | Type | Required | Description |
| :--- | :---: | :---: | :--- |
| `x-organization-id` | `string` | **Yes** | Multi-tenant organization isolation scope |
| `x-user-id` | `string` | **Yes** | Authenticated user identifier |
| `x-user-roles` | `string` | No | Comma-separated roles (e.g. `admin,operator,user`) |
| `x-user-permissions` | `string` | No | Comma-separated permission tokens |

---

## 2. API Endpoint Matrix

### 2.1 Schema & Entity Discovery
#### `GET /api/v1/data-imports/entities`
- **Purpose**: List all registered importable entities and their modules.
- **Permission**: `DATA_IMPORT_VIEW`
- **Response 200**:
  ```json
  {
    "success": true,
    "data": [
      { "entity": "contacts", "displayName": "Contacts", "module": "crm", "version": 1 }
    ]
  }
  ```

#### `GET /api/v1/data-imports/entities/:entity`
- **Purpose**: Get field metadata, validation rules, and duplicate matching criteria for an entity.
- **Permission**: `DATA_IMPORT_VIEW`

---

### 2.2 Import Lifecycle & Ingestion
#### `POST /api/v1/data-imports`
- **Purpose**: Create a new draft import job.
- **Permission**: `DATA_IMPORT_CREATE`
- **Request Body**:
  ```json
  {
    "name": "Q3 Customers Import",
    "targetModule": "crm",
    "targetEntity": "contacts",
    "sourceType": "FILE_UPLOAD",
    "importOptions": {
      "duplicateStrategy": "UPDATE",
      "errorStrategy": "CONTINUE_ON_ERROR"
    }
  }
  ```
- **Response 201**: Returns created `DataImportEntity` (`status: DRAFT`).

#### `POST /api/v1/data-imports/:id/upload`
- **Purpose**: Upload and validate source file (Multipart or Base64 JSON).
- **Permission**: `DATA_IMPORT_UPLOAD`
- **Request Body**: `{ "filename": "contacts.csv", "content": "base64...", "encoding": "base64", "mimeType": "text/csv" }`
- **Response 200**: File validated, stored, status transitions to `UPLOADED`.

#### `POST /api/v1/data-imports/:id/parse`
- **Purpose**: Parse staged file, extract headers, and generate preview rows.
- **Permission**: `DATA_IMPORT_VALIDATE`
- **Response 200**: `{ "rowCount": 1500, "headers": ["First Name", "Email"], "sampleRows": [...] }`

---

### 2.3 Mapping & Transformation
#### `GET /api/v1/data-imports/:id/mapping/suggestions`
- **Purpose**: Automatically suggest mapping between parsed headers and schema fields.
- **Permission**: `DATA_IMPORT_VIEW`

#### `POST /api/v1/data-imports/:id/mapping`
- **Purpose**: Save user mapping definitions and default values.
- **Permission**: `DATA_IMPORT_MAP`
- **Request Body**:
  ```json
  {
    "columnMappings": {
      "First Name": { "targetField": "first_name", "mappingMethod": "MANUAL", "enabled": true },
      "Email": { "targetField": "email", "mappingMethod": "MANUAL", "enabled": true }
    },
    "unmappedBehavior": "IGNORE"
  }
  ```
- **Response 200**: Saved mapping entity, status transitions to `MAPPED`.

---

### 2.4 Validation & Duplicate Matching
#### `POST /api/v1/data-imports/:id/validate`
- **Purpose**: Execute 4-tier validation pipeline and stage records in database.
- **Permission**: `DATA_IMPORT_VALIDATE`
- **Response 200**: `{ "validRows": 1490, "invalidRows": 10, "warningRows": 5, "totalErrors": 10 }`

#### `POST /api/v1/data-imports/:id/detect-duplicates`
- **Purpose**: Execute duplicate key generation and target database record matching.
- **Permission**: `DATA_IMPORT_VALIDATE`
- **Response 200**: `{ "newRecords": 1200, "existingRecords": 290, "duplicateInFile": 10, "conflicts": 0 }`

---

### 2.5 Review, Governance Approval & Execution
#### `GET /api/v1/data-imports/:id/review`
- **Purpose**: Evaluate 8-point pre-execution governance checklist.
- **Permission**: `DATA_IMPORT_VIEW`

#### `POST /api/v1/data-imports/:id/approve`
- **Purpose**: Formally approve import job with SHA-256 state snapshot hash.
- **Permission**: `DATA_IMPORT_APPROVE`
- **Request Body**: `{ "decision": "APPROVE", "reason": "Verified and approved for release" }`
- **Response 200**: Approval receipt with snapshot hash, status transitions to `APPROVED`.

#### `POST /api/v1/data-imports/:id/execute`
- **Purpose**: Trigger transactional batch execution into target system.
- **Permission**: `DATA_IMPORT_EXECUTE`
- **Request Body**: `{ "batchSize": 500 }`
- **Response 200**: `{ "successfulCreates": 1200, "successfulUpdates": 290, "skippedRecords": 10, "failedRecords": 0 }`

---

### 2.6 Reconciliation, Reporting & Recovery
#### `POST /api/v1/data-imports/:id/reconcile`
- **Purpose**: Execute post-import row-by-row verification of database writes.
- **Permission**: `DATA_IMPORT_VALIDATE`
- **Response 200**: `{ "status": "FULLY_RECONCILED", "mismatchCount": 0 }`

#### `GET /api/v1/data-imports/:id/report`
- **Purpose**: Retrieve comprehensive 5-tier final report.
- **Permission**: `DATA_IMPORT_VIEW`

#### `GET /api/v1/data-imports/:id/report/export?format=csv`
- **Purpose**: Download sanitized CSV report or failed records list.
- **Permission**: `DATA_IMPORT_VIEW`

#### `POST /api/v1/data-imports/:id/retry`
- **Purpose**: Retry transient failed records without duplicating successful writes.
- **Permission**: `DATA_IMPORT_EXECUTE`

#### `POST /api/v1/data-imports/:id/cancel`
- **Purpose**: Cancel active import job from cancellable states.
- **Permission**: `DATA_IMPORT_CANCEL`
