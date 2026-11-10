# Data Import Centre — Duplicate Detection & Record Matching Engine Architecture

## 1. Executive Summary & Architectural Overview

Phase 6 implements the **Duplicate Detection and Record Matching Engine** for the enterprise Data Import Centre. Following dataset parsing, column mapping, deterministic transformation, and multi-tier validation, every record must undergo identity resolution and record classification prior to final review, approval, and execution.

```text
Uploaded File
      ↓
Parsed Dataset
      ↓
Column Mapping
      ↓
Transformation Pipeline
      ↓
Progressive Multi-Tier Validation
      ↓
Duplicate Detection Engine
      ├── Match Key Generator (Length-Prefixed Canonical Serialization & SHA-256)
      ├── Intra-File Duplicate Grouper (Row Index Preservation)
      └── Target System Batch Matcher (Tenant-Isolated Provider Abstraction)
      ↓
Record Classification & Explainability
      ├── NEW
      ├── EXISTING
      ├── DUPLICATE_IN_FILE
      ├── MULTIPLE_MATCH
      ├── CONFLICT
      ├── UNRESOLVED
      └── INVALID
      ↓
Execution Intent Resolution (CREATE, UPDATE, SKIP, REVIEW, BLOCKED)
      ↓
Staged Record Persistence & Audit Logging
      ↓
Preview & Verification APIs
```

---

## 2. Duplicate Strategies & Execution Intent Semantics

The platform supports four core duplicate resolution strategies coupled with import modes (`INSERT_ONLY`, `UPDATE_ONLY`, `UPSERT`):

| Duplicate Strategy | Target Match Status | Execution Intent Action | Blocked Status | Explainable Decision Rationale |
|---|---|---|---|---|
| **SKIP** | No Target Match (`NEW`) | `CREATE` | `false` | Record does not exist in target system; marked for creation. |
| **SKIP** | 1 Target Match (`EXISTING`) | `SKIP` | `false` | Existing target record found; skipped per `SKIP` duplicate strategy. |
| **UPDATE** | 1 Target Match (`EXISTING`) | `UPDATE` | `false` | Existing target record matched; queued for update with transformed delta. |
| **UPDATE** | No Target Match (`NEW`) | `CREATE` (or `BLOCKED` if `UPDATE_ONLY`) | `false` | New record created under upsert semantics. |
| **REJECT** | 1 Target Match (`EXISTING`) | `BLOCKED` | `true` | Existing record found; rejected per strict `REJECT` strategy. |
| **MANUAL_REVIEW** | 1 Target Match (`EXISTING`) | `REVIEW` | `true` | Existing target record requires explicit manual review before execution. |
| **ANY** | Intra-File Duplicate (`DUPLICATE_IN_FILE`) | `SKIP` / `BLOCKED` / `REVIEW` | Strategy dependent | Subsequent row with identical match key within the same import file. |
| **ANY** | Multiple Target Matches (`MULTIPLE_MATCH`) | `BLOCKED` | `true` | Ambiguous match against multiple target records; prevented from unsafe mutation. |
| **ANY** | Missing Key (`UNRESOLVED`) | `BLOCKED` | `true` | Missing mandatory match key components. |
| **ANY** | Failed Validation (`INVALID`) | `BLOCKED` | `true` | Record contains validation errors from prior validation tiers. |

---

## 3. Match Key Generation, Normalization & Collision Safety

### 3.1. Entity Schema Driven Rules
Match key generation is defined authoritatively in the `EntitySchemaRegistry`:
- **Single-Field Match**: Unique identifiers such as `email`, `sku`, or `invoice_number`.
- **Composite Match**: Interdependent multi-column identifiers such as `[first_name, last_name, phone]` or `[country, external_customer_id]`.

### 3.2. Collision-Safe Canonical Token Encoding
To eliminate structural concatenation collisions (where `["AB", "C"]` might naively collide with `["A", "BC"]`), `MatchKeyGenerator` applies length-prefixed token encoding:
$$\text{Token}_i = \text{fieldName}_i + \text{":"} + \text{length}(\text{value}_i) + \text{":"} + \text{value}_i$$
$$\text{CanonicalKey} = \text{Token}_1 \mid \text{Token}_2 \mid \dots \mid \text{Token}_n$$

### 3.3. Deterministic Hashing
Every canonical key is hashed using cryptographic **SHA-256**:
$$\text{MatchKeyHash} = \text{SHA-256}(\text{CanonicalKey})$$
This 64-character hexadecimal string provides collision-proof indexing and fast $O(1)$ equality lookups.

### 3.4. Safe Field Normalization
- **Email**: Trimmed, outer whitespace removed, and converted to lowercase.
- **Phone**: Punctuation, dashes, parentheses, and spaces stripped; international format normalized.
- **Null / Empty Handling**: If any component of a match key is `null`, `undefined`, or empty string, key generation returns `null`, classifying the record as `UNRESOLVED` rather than generating false collisions across empty rows.

---

## 4. Intra-File Duplicate Detection & Grouping

Before querying the target system, all valid records are grouped by their `MatchKeyHash`:
1. **First Occurrence**: The earliest row in the import file (lowest row index) is retained as the candidate for target lookup and potential creation/update.
2. **Subsequent Occurrences**: Classified as `DUPLICATE_IN_FILE`.
3. **Row Index Preservation**: Every affected row number is recorded in a `DuplicateGroup` structure:
```json
{
  "matchKey": "alice@example.com",
  "matchKeyHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "recordIds": ["rec-1", "rec-3"],
  "sourceRowNumbers": [1, 3],
  "count": 2,
  "classification": "DUPLICATE_IN_FILE"
}
```

---

## 5. Target Match Provider Abstraction & Batch Query Optimization

### 5.1. Decoupled Provider Contract
The `ITargetMatchProvider` interface decouples the duplicate engine from specific database tables or business entities:
```typescript
export interface ITargetMatchProvider {
  readonly entity: string;
  findByMatchKeys(
    organizationId: string,
    matchKeyHashes: string[],
    matchKeys: string[]
  ): Promise<Map<string, TargetRecordMatch[]>>;
  getRecord(organizationId: string, recordId: string): Promise<Record<string, unknown> | null>;
}
```

### 5.2. Batch Lookup to Eliminate N+1 Queries
Instead of executing one database query per import row, the engine:
1. Gathers all unique candidate `MatchKeyHash` values across the dataset.
2. Dispatches a single batched lookup to `findByMatchKeys`.
3. Constructs an in-memory hash map for $O(1)$ candidate classification.

---

## 6. Record Classification & Explainability

Every staged record is assigned a deterministic classification and human-readable explanation:
1. `NEW` — No matching target record exists in the system.
2. `EXISTING` — Exactly one target record matched the configured unique key.
3. `DUPLICATE_IN_FILE` — Matches an earlier row within the current uploaded file.
4. `MULTIPLE_MATCH` — Matches two or more distinct target records (ambiguity conflict).
5. `CONFLICT` — Incompatible uniqueness constraint collision.
6. `UNRESOLVED` — Required match key is missing or blank.
7. `INVALID` — Failed structural, syntactic, or business validation in Phase 5.

---

## 7. Multi-Tenant Security & RBAC Isolation

- **Tenant Boundary**: All target queries, lookups, and staging records are strictly partitioned by `organizationId`. A record uploaded by Tenant A can never match or expose target data belonging to Tenant B.
- **RBAC Guards**:
  - `POST /api/v1/data-imports/:id/detect-duplicates` requires `DATA_IMPORT_VALIDATE` or `DATA_IMPORT_EXECUTE`.
  - `GET /api/v1/data-imports/:id/match-preview` requires `DATA_IMPORT_VIEW`.

---

## 8. REST API Endpoints

### 8.1. Run Duplicate Detection
`POST /api/v1/data-imports/:id/detect-duplicates`
- **Request Body**: `{}` (optional `overrideStrategy`)
- **Response**: `200 OK` with full `DuplicateSummary` metrics.

### 8.2. Paginated Match Preview
`GET /api/v1/data-imports/:id/match-preview?page=1&limit=50&classification=EXISTING&action=UPDATE`
- **Query Parameters**: `page`, `limit`, `classification`, `action`, `isDuplicate`, `isBlocked`.
- **Response**: `200 OK` with paginated `DuplicatePreviewItem[]`.
