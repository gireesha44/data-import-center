# Data Import Centre — Entity Schema Registry & Column Mapping Engine (Phase 4)

## 1. Entity Schema Registry Architecture

The [EntitySchemaRegistry](file:///src/core/registry/entity-schema.registry.ts) serves as the authoritative, centralized single source of truth for all importable target entities, field metadata, data types, validation rules, constraints, and duplicate detection policies.

```text
Parsed Dataset
      ↓
Source Columns (with inferred types & statistics)
      ↓
Entity Schema Registry (Authoritative target entity definitions)
      ↓
Deterministic Mapping Suggestion Engine (Exact, Normalized, Alias, Label, Token Scoring)
      ↓
User Manual Mapping & Ambiguity Resolution
      ↓
Mapping Validator Service (Structural, Required Fields, Type Compatibility, Read-Only Protection)
      ↓
Saved Mapping Configuration (DataImportMappingEntity & State Transition to MAPPED)
```

---

## 2. Importable Entity Definitions

The registry currently provides out-of-the-box definitions for core business entities:

| Module | Entity | Display Name | Required Fields | Key Aliases & Features |
|---|---|---|---|---|
| **CRM** | `contacts` | Customer Contacts | `first_name`, `last_name`, `email` | Aliases for `fname`, `surname`, `email_address`, `cell_phone`, `company`. Read-only `id` protected. |
| **Inventory** | `products` | Product Catalog | `sku`, `name`, `price` | Aliases for `product_code`, `title`, `unit_price`, `cost`, `qty`. |
| **Finance** | `invoices` | Invoices | `invoice_number`, `customer_email`, `total_amount`, `issue_date` | Aliases for `inv_number`, `billing_email`, `grand_total`, `invoice_date`. |

---

## 3. Strongly Typed Field Definitions

Each entity field is defined via `EntityFieldDefinition`:
- `name`: Technical identifier (e.g. `first_name`).
- `label`: Human-readable label (e.g. `First Name`).
- `type`: Strongly typed `FieldDataType` (`STRING`, `NUMBER`, `DECIMAL`, `BOOLEAN`, `DATE`, `DATETIME`, `EMAIL`, `PHONE`, `ENUM`, `IDENTIFIER`, `REFERENCE`).
- `required`: Boolean flag indicating if mapping is mandatory.
- `readOnly`: Flags system-managed fields that cannot be mapped from input data.
- `aliases`: Array of recognized alternative header names used for automated scoring.
- `enumValues`: Array of valid options for `ENUM` fields.
- `constraints`: Optional constraints (e.g. `min`, `max`, `minLength`, `maxLength`, `pattern`, `sensitive`).

---

## 4. Source Column Model & Metrics

Extracted from the Phase 3 `ParsedDataset`:
- `originalName`: Exact header name from uploaded file.
- `normalizedName`: Deterministic snake_case representation.
- `inferredType`: Data type inferred from sample values (`EMAIL`, `PHONE`, `BOOLEAN`, `NUMBER`, `DECIMAL`, `DATE`, `STRING`).
- `sampleValues`: Bounded slice of representative non-empty values.
- `emptyPercentage`: Calculated null/empty cell percentage.
- `statistics`: Total sample count, distinct value count, and null count.

---

## 5. Header Normalization & Tokenization

[ColumnNormalizer](file:///src/domain/mapping/column-normalizer.ts) normalizes headers using deterministic rules:
- Converts camelCase / PascalCase to separated words (`firstName` → `first_name`).
- Replaces non-alphanumeric characters with spaces.
- Collapses whitespace and transforms to lowercase snake_case.
- Preserves the `originalName` alongside `normalizedName` for complete UI traceability.

---

## 6. Automatic Mapping Heuristics & Scoring

The [DeterministicMappingSuggestionProvider](file:///src/domain/mapping/mapping-suggestion.provider.ts) scores potential matches using a weighted multi-signal engine:
1. **Exact Name Match** (Score `1.0`, Confidence `HIGH`): Source name matches target name exactly.
2. **Normalized Name Match** (Score `0.95`, Confidence `HIGH`): Normalized source matches normalized target.
3. **Alias Match** (Score `0.90`, Confidence `HIGH`): Source matches one of target field's declared aliases.
4. **Label Match** (Score `0.85`, Confidence `HIGH`): Normalized source matches normalized display label.
5. **Token Subset Overlap** (Score `0.75`, Confidence `MEDIUM`): Token array of one is a subset of the other.
6. **Fuzzy String Similarity** (Score `0.50`–`0.74`, Confidence `LOW`/`MEDIUM`): Levenshtein similarity ratio $\ge 0.70$.

---

## 7. Ambiguity Handling & Conflict Resolution

- **Ambiguous Match**: If the top two target candidates have scores $\ge 0.65$ within $0.08$ of each other, the engine marks `isAmbiguous: true`, leaves `suggestedTargetField` undefined, and packages candidate options in `alternatives`.
- **Target Collision Resolution**: If two source columns match the same target field, the source column with the highest score wins the assignment; the lower-scoring column falls back to alternatives.

---

## 8. Type Compatibility Evaluation

[TypeCompatibilityEvaluator](file:///src/domain/mapping/type-compatibility.evaluator.ts) evaluates source inferred types against target field types:
- `COMPATIBLE`: Direct assignment without transformation (e.g. `NUMBER` → `NUMBER`, `NUMBER` → `DECIMAL`, anything → `STRING`).
- `TRANSFORM_REQUIRED`: Source type requires parsing or conversion in Phase 5 (e.g. `STRING` → `NUMBER`, `STRING` → `DATE`, `STRING` → `BOOLEAN`).
- `INCOMPATIBLE`: Semantic mismatch (e.g. `EMAIL` → `NUMBER`, `PHONE` → `DECIMAL`).
- `UNKNOWN`: Insufficient sample data to determine compatibility.

---

## 9. Manual Mapping Operations

Users can:
- Map a source column to a target field.
- Unmap or clear individual column assignments.
- Set default fallback values for unmapped or optional fields.
- Re-map or change mapping configurations.
- Configure `unmappedBehavior`: `'IGNORE'` or `'SET_NULL'`.

---

## 10. Mapping Validation Service

[MappingValidatorService](file:///src/domain/mapping/mapping-validator.service.ts) performs strict server-side validation:
- **Structural Integrity**: Source columns exist in dataset; target fields exist on entity schema.
- **Read-Only Protection**: Rejects mapping to read-only fields (`readOnly: true`).
- **Duplicate Target Prevention**: Prevents multiple source columns from writing to the same target field.
- **Required Fields Enforcement**: Ensures all non-read-only required target fields are mapped.
- **Compatibility Auditing**: Identifies incompatible type pairs and flags transform-required warnings.

---

## 11. Mapping Persistence & State Machine Integration

- Mappings are stored in `data_import_mappings` via [DataImportMappingEntity](file:///src/domain/entities/data-import-mapping.entity.ts).
- Associated with `importId`, `organizationId`, and timestamp.
- State transitions via [ImportStateMachine](file:///src/domain/state-machine/import-state-machine.ts):
  - Valid & Complete Mapping: `PARSED` → `MAPPING` → `MAPPED`
  - Incomplete Mapping (Missing required field): `PARSED` → `MAPPING`
- Clearing Mapping: Reverts state to `PARSED`.
- Audit logs: Emits `IMPORT_MAPPING_SAVED` and `IMPORT_MAPPING_CLEARED` events.

---

## 12. REST APIs

| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `/api/v1/data-imports/entities` | `GET` | `DATA_IMPORT_VIEW` | Discovers all available importable entities |
| `/api/v1/data-imports/entities/:entity` | `GET` | `DATA_IMPORT_VIEW` | Returns detailed schema for an entity |
| `/api/v1/data-imports/:id/mapping/suggestions` | `GET` | `DATA_IMPORT_VIEW` | Generates deterministic auto-mapping suggestions |
| `/api/v1/data-imports/:id/mapping` | `GET` | `DATA_IMPORT_VIEW` | Retrieves current saved mapping and validation status |
| `/api/v1/data-imports/:id/mapping` | `POST` | `DATA_IMPORT_MAP` | Saves column mapping and updates lifecycle state |
| `/api/v1/data-imports/:id/mapping/validate` | `POST` | `DATA_IMPORT_VIEW` | Validates candidate mapping without persisting |
| `/api/v1/data-imports/:id/mapping` | `DELETE` | `DATA_IMPORT_MAP` | Clears saved mapping and reverts state to `PARSED` |

---

## 13. Security & Multi-Tenant Controls

- **Multi-Tenant Isolation**: Tenant B cannot view suggestions, retrieve mappings, or save mappings for imports owned by Tenant A (returns HTTP 404).
- **RBAC Authorization**: Saving and clearing mappings strictly requires `DATA_IMPORT_MAP` permission.
- **Schema Boundary Guard**: Mapping engine rejects unknown entity names and arbitrary internal database fields.
- **Read-Only Enforcement**: Server-side validation rejects mapping payloads targeting read-only attributes.

---

## 14. Verification & Automated Test Suite

Phase 4 is verified with **117 automated tests** across **23 test suites** with 100% pass rate:
- `EntitySchemaRegistry`: Registration, schema validation, duplicate field rejection, required field discovery (7 tests).
- `ColumnNormalizer`: Header normalization, token extraction, Levenshtein distance, type inference (5 tests).
- `TypeCompatibilityEvaluator`: Compatible types, numeric conversions, transform requirements, incompatible types (6 tests).
- `DeterministicMappingSuggestionProvider`: Exact matches, alias variations, label matches, conflict resolution, alternatives (5 tests).
- `MappingValidatorService`: Valid mappings, unmapped required fields, unknown targets, read-only field rejection, duplicate target rejection (5 tests).
- `MappingService`: Suggestion generation, permission checks, save mapping & state transition to `MAPPED`, incomplete mapping state transition to `MAPPING`, clear mapping (5 tests).
- `Mapping & Schema HTTP APIs`: Entity discovery, schema detail retrieval, complete end-to-end integration flow, multi-tenant isolation (4 tests).
- `Phase 2 Foundation & Phase 3 Parsers`: Complete regression suite passing (80 tests).

---

## 15. Known Limitations

1. **AI-Assisted Mapping**: AI extension point is prepared via `IMappingSuggestionProvider` contract; actual LLM-based suggestion provider is scheduled for Phase 10.
2. **Transformations**: Transform definitions are captured in `ColumnMapping` and will be executed by the Transformation Engine in Phase 5.
