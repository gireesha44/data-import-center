# Data Import Centre — Transformation & Multi-Tier Validation Engine

## 1. Architecture and Pipeline Data Flow

The **Transformation Engine** and **Multi-Tier Validation Engine** form Phase 5 of the Data Import Centre platform. They take the raw cell values parsed in Phase 3 and column mappings configured in Phase 4, executing deterministic transformations and progressive validation checks before staging records in the database.

```text
 Uploaded File / Ingestion Buffer
               │
               ▼
   [Phase 3: File Parsers]
   (CSV / XLSX / JSON / XML)
               │
               ▼
   Raw Dataset & Headers
               │
               ▼
   [Phase 4: Column Mapping Engine]
   (Mapped Headers & Configured Transforms)
               │
               ▼
   ╔════════════════════════════════════════════════════════════════════╗
   ║                   PHASE 5: TRANSFORMATION & VALIDATION             ║
   ║                                                                    ║
   ║  1. Cell-Level Transformation Pipeline                             ║
   ║     • NULL_NORMALIZE & TRIM                                        ║
   ║     • User/Template Custom Transformers (Prefix, Case, etc.)       ║
   ║     • Target Schema Type Conversions (Number, Decimal, Date, Enum) ║
   ║                                                                    ║
   ║  2. Progressive Multi-Tier Validation Engine                       ║
   ║     • Tier 2: Field-Level Validation (Type, Pattern, Enum, Range)  ║
   ║     • Tier 3: Cross-Field Validation (Date Sequences, Sums)        ║
   ║     • Tier 4: Entity Business Rules (High Value, Balance, Custom)  ║
   ║                                                                    ║
   ║  3. Record Status & Validation Summary Computation                 ║
   ║     • VALID, WARNING, or INVALID assignment                        ║
   ║     • Error count, warning count, field issue statistics           ║
   ║                                                                    ║
   ║  4. Staged Records Persistence & Audit Logging                     ║
   ║     • Saved to `data_import_records` repository                    ║
   ║     • Import status transition: VALIDATED / VALIDATION_FAILED      ║
   ╚════════════════════════════════════════════════════════════════════╝
               │
               ▼
     Staged Records Table (`data_import_records`)
     & Paginated Validation Preview API (`/validation-preview`)
```

---

## 2. Transformation Engine Design

The Transformation Engine is designed around single-responsibility, bounded, deterministic transformations that execute sequentially per cell.

### Core Principles
1. **Side-Effect Free**: Transformations do not access databases, network endpoints, file systems, or mutate external state.
2. **Deterministic**: Given the same input, options, and context, a transformer will always produce the exact same output.
3. **Bounded Execution**: Transformation chains have a hard length limit (`MAX_TRANSFORM_CHAIN_LENGTH = 10`) preventing unbounded loops.
4. **Resilient Failure Handling**: A transformation failure does not crash the pipeline; the error is captured on the cell and converted into a `TRANSFORMATION_ERROR` field validation issue.

---

## 3. Built-in Transformers Inventory

| Transformer | Identifier | Description | Supported Options |
|---|---|---|---|
| `TrimTransformer` | `TRIM` | Strips leading and trailing whitespace from strings | None |
| `LowercaseTransformer` | `LOWERCASE` | Converts strings to lower case | None |
| `UppercaseTransformer` | `UPPERCASE` | Converts strings to upper case | None |
| `NullNormalizeTransformer` | `NULL_NORMALIZE` | Converts empty strings and markers (`null`, `N/A`, `-`, etc.) to `null` | `nullMarkers: string[]` |
| `ToStringTransformer` | `TO_STRING` | Converts any primitive or object to its string representation | None |
| `ToNumberTransformer` | `TO_NUMBER` | Cleanses currency/commas and truncates to signed integer | None |
| `ToDecimalTransformer` | `TO_DECIMAL` | Cleanses currency/commas and parses floating-point decimal | `precision: number` |
| `ToBooleanTransformer` | `TO_BOOLEAN` | Parses truthy (`true`, `1`, `yes`, `y`) and falsy (`false`, `0`, `no`, `n`) | None |
| `ToDateTransformer` | `TO_DATE` | Parses ISO dates, timestamps, and returns standard `YYYY-MM-DD` | `format: string` |
| `ToDateTimeTransformer` | `TO_DATETIME` | Parses timestamps and returns ISO 8601 UTC string | None |
| `PhoneFormatTransformer` | `PHONE_FORMAT` | Cleanses non-digits and normalizes international E.164-style numbers | `defaultCountryCode: string` |
| `PrefixSuffixTransformer` | `PREFIX_SUFFIX` | Prepends prefix and/or appends suffix to string | `prefix: string`, `suffix: string` |
| `DefaultValueTransformer` | `DEFAULT_VALUE` | Substitutes default value if source value is `null`, `undefined`, or `''` | `defaultValue: unknown` |

---

## 4. Determinism and Side-Effect Freedom

To guarantee safety in multi-tenant environments:
- **No Dynamic Code Evaluation**: Neither `eval()`, `new Function()`, nor external scripting runtimes are permitted in transformation definitions.
- **Pure Transformations**: Transformers operate strictly on primitive arguments and local contextual metadata (`rowIndex`, `targetField`).
- **Memory Predictability**: Transformers create localized string copies without allocating large internal structures.

---

## 5. Validation Engine Multi-Tier Architecture

Validation is organized into four hierarchical tiers:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Tier 1: File & Format Validation (Phase 3)                       │
│ • Magic byte verification, MIME validation, XXE/bomb protection  │
└─────────────────────────────────┬────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│ Tier 2: Field-Level Validation (Phase 5)                         │
│ • Required fields, data types, enum sets, email/phone formats    │
└─────────────────────────────────┬────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│ Tier 3: Cross-Field Validation (Phase 5)                         │
│ • Multi-column constraints (issue_date <= due_date)              │
└─────────────────────────────────┬────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│ Tier 4: Entity Business Rules (Phase 5)                          │
│ • Domain rules, warning thresholds (e.g. invoice > 100k review)  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Tier 1: File & Format Validation (Phase 3 Reference)
Executed during initial upload and parsing in Phase 3. Blocks malicious payloads, zip bombs, and invalid MIME types before raw rows reach the transformation pipeline.

---

## 7. Tier 2: Field-Level Validation
Field validators evaluate individual cell values against `EntityFieldDefinition` constraints:
- **`RequiredValidator`**: Flags missing values for non-read-only required fields (`REQUIRED_FIELD_MISSING`).
- **`DataTypeValidator`**: Enforces strict typing for `NUMBER`, `DECIMAL`, `BOOLEAN`, `DATE`, `DATETIME`, `JSON`.
- **`EnumValidator`**: Validates value inclusion against schema `enumValues` (`INVALID_ENUM_VALUE`).
- **`EmailValidator`**: Validates syntax against standard RFC email patterns (`INVALID_EMAIL_FORMAT`).
- **`PhoneValidator`**: Enforces phone number format and minimum digit lengths (`INVALID_PHONE_FORMAT`).
- **`StringConstraintValidator`**: Enforces `minLength`, `maxLength`, and regex `pattern` constraints (`STRING_LENGTH_VIOLATION`, `PATTERN_MISMATCH`).
- **`NumericRangeValidator`**: Enforces `min` and `max` numeric bounds (`MIN_VALUE_VIOLATION`, `MAX_VALUE_VIOLATION`).

---

## 8. Tier 3: Cross-Field Validation
Cross-field validators check interdependent columns within the same row:
- **`DateRangeCrossFieldValidator`**: Verifies that chronological field pairs satisfy natural sequencing:
  - `issue_date` <= `due_date`
  - `start_date` <= `end_date`

---

## 9. Tier 4: Entity Business Rules
Entity-specific validators register tailored business domain constraints:
- **`ContactsBusinessValidator`**: Warns if a contact record has neither an email nor a phone number (`MISSING_CONTACT_METHOD`).
- **`ProductsBusinessValidator`**: Rejects negative unit price (`NEGATIVE_PRICE`) or negative stock quantity (`NEGATIVE_STOCK`).
- **`InvoicesBusinessValidator`**: Rejects negative total amount (`NEGATIVE_INVOICE_TOTAL`) and flags high-value invoices (> 100,000) with a `WARNING` severity (`HIGH_VALUE_INVOICE`).

---

## 10. Error vs Warning Severity Handling

Validation issues are categorized into two active severities:

| Severity | Effect on Record Status | Effect on Import Job State | User Action |
|---|---|---|---|
| **`ERROR`** | `RecordStatus.INVALID` | `ImportStatus.VALIDATION_FAILED` | Must be resolved/corrected before execution |
| **`WARNING`** | `RecordStatus.WARNING` | `ImportStatus.VALIDATED` | Flagged in preview; user can proceed with import |
| **`INFORMATION`** | `RecordStatus.VALID` | `ImportStatus.VALIDATED` | Informational tip / metadata note |

A row with at least one `ERROR` is marked `INVALID`. A row with only `WARNING` issues is marked `WARNING` and remains valid for downstream processing.

---

## 11. Validation Results and Error Reporting

Each validation issue records detailed diagnostic information:
```json
{
  "field": "due_date",
  "code": "INVALID_DATE_RANGE",
  "severity": "ERROR",
  "message": "Due Date (2026-05-01) cannot be earlier than Issue Date (2026-05-31)",
  "sourceValue": "2026-05-01",
  "transformedValue": "2026-05-01"
}
```

---

## 12. Validation Summary & Staged Record Entity Model

### Validation Summary (`ValidationSummary`)
Calculated at the dataset level for instant UI feedback:
```typescript
interface ValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  errorCount: number;
  warningCount: number;
  durationMs: number;
  fieldIssueCounts: Record<string, number>;
  issuesByCode: Record<string, number>;
}
```

### Staged Record Domain Entity (`DataImportRecordEntity`)
Saved in `data_import_records`:
- `id`: Unique UUID
- `organizationId`: Multi-tenant partition
- `importId`: Parent import job
- `rowIndex`: 1-indexed row position
- `rawData`: Original unparsed source cell values
- `transformedData`: Cleaned, type-converted values
- `status`: `VALID` | `WARNING` | `INVALID` | `DUPLICATE` | `PENDING`
- `validationErrors`: Array of validation issues

---

## 13. Validation API Endpoints

### 1. `POST /api/v1/data-imports/:id/validate`
- **Permission**: `DATA_IMPORT_VALIDATE`
- **Payload**: `{ "dryRun": false, "maxErrors": 1000 }`
- **Behavior**: Executes transformation pipeline and multi-tier validation, stages records into repository, updates import counters, and transitions state to `VALIDATED` or `VALIDATION_FAILED`.
- **Response**: `200 OK` with `ValidationSummary`.

### 2. `GET /api/v1/data-imports/:id/validation-preview`
- **Permission**: `DATA_IMPORT_VIEW`
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Records per page (default: 50, max: 500)
  - `status`: Filter by record status (`VALID`, `WARNING`, `INVALID`)
- **Response**: `200 OK` with paginated staged records, raw data, transformed data, validation issues, and pagination metadata.

---

## 14. Error Strategy Handling
- **`CONTINUE_ON_ERROR`**: Valid records can proceed to duplicate detection and execution; invalid records are skipped or staged for review.
- **`ALL_OR_NOTHING`**: If `invalidRows > 0`, execution is blocked until all records pass validation.

---

## 15. Import State Machine Integration

```text
       [ MAPPED ]
           │
           │ POST /:id/validate
           ▼
     [ VALIDATING ]
      /          \
     /            \
(All Valid)   (Has Errors)
   ▼                ▼
[ VALIDATED ]  [ VALIDATION_FAILED ]
```

---

## 16. Security, Isolation, and Resource Limits
- **Tenant Isolation**: Every staged record and validation check enforces `organizationId` matching.
- **RBAC Guards**: `DATA_IMPORT_VALIDATE` required to trigger validation; `DATA_IMPORT_VIEW` required for preview.
- **Chain Length Limit**: Maximum 10 transformations per cell to prevent resource exhaustion.

---

## 17. Extensibility Model
1. **Custom Transformers**: Implement `ITransformation` and register via `transformationRegistry.registerTransformer(new CustomTransformer())`.
2. **Custom Entity Business Validators**: Implement `IBusinessValidator` with target `entity` name and register via `entityValidatorRegistry.register(new CustomValidator())`.

---

## 18. Test Coverage and Verification

Phase 5 includes comprehensive test suites across all transformation and validation components:
- `src/tests/unit/transformation/built-in-transformers.test.ts`: 100% unit test coverage of all 13 built-in transformers.
- `src/tests/unit/transformation/transformation-pipeline.test.ts`: Schema defaults, custom transforms, and error containment.
- `src/tests/unit/validation/field-validators.test.ts`: Required, DataType, Enum, Email, Phone, StringConstraint, NumericRange.
- `src/tests/unit/validation/cross-field-validators.test.ts`: Chronological sequence rules.
- `src/tests/unit/validation/validation-engine.test.ts`: Multi-tier orchestration and summary computations.
- `src/tests/unit/validation/validation-service.test.ts`: Repository staging, state machine transitions, and audit logs.
- `src/tests/integration/validation-api.test.ts`: End-to-end integration flow (Create -> Upload -> Parse -> Map -> Validate -> Preview) and multi-tenant security verification.

**Total Project Test Status**: 159 tests passing across 43 test suites (100% pass rate).
