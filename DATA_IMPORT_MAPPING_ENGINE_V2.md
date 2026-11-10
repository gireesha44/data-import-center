# Data Import Centre — Enterprise Mapping & Cell-Correction Engine v2

## Mapping pipeline

```text
Uploaded File
  ↓
Schema / Entity Context
  ↓
Column + Cell Profiling
  ↓
Deterministic Rules
  ↓
Fuzzy Similarity
  ↓
Semantic / Embedding-Style Similarity
  ↓
Data-Type Compatibility
  ↓
Sample-Value Pattern Detection
  ↓
Conflict + Ambiguity Resolution
  ↓
Confidence + Explanation
  ↓
High-confidence auto-apply / low-confidence human review
  ↓
Transformation + Validation
```

### Mapping signals

1. Exact / normalized field-name rules
2. Configured aliases and labels
3. Token overlap
4. Levenshtein fuzzy similarity
5. Local semantic vector similarity using business synonym concepts
6. Source data-type compatibility
7. Sample-value pattern compatibility
8. Optional external AI enrichment when `DATA_IMPORT_AI_MAPPING_URL` is configured

The optional AI provider is an enrichment layer only. It cannot overwrite a high-confidence deterministic match and failures fall back to the local engine.

### Confidence

- **HIGH (>= 85%)** — eligible for automatic application when there is no competing match.
- **MEDIUM (70–84%)** — shown as a confident suggestion and retained for review where required.
- **LOW (< 70%)** — never silently applied; the operator must choose a target.
- A close top-two score is treated as **AMBIGUOUS** and requires human selection.

Every mapping suggestion includes:

- confidence score
- mapping techniques used
- human-readable evidence
- alternative candidates
- recommended safe transformations
- transformation confidence/explanation

## Value mapping and normalization

Enum normalization is deterministic and safe:

- exact match
- case-insensitive match
- punctuation/spacing normalization
- explicitly configured enum aliases
- unique acronym matching (for example `HR` / `H.R.` → `Human Resources` when that canonical enum exists)

Ambiguous business values are never guessed.

## Cell-level corrections

Each invalid cell has its own correction control. Correcting one cell does not overwrite other invalid cells in the same row.

The correction UI shows:

- what happened
- the current value
- what the user must change
- expected format/example
- a dedicated **Apply & Revalidate** action

The exact value entered by the user is retained in the staged raw record. The normal transformation pipeline converts it to the target type during revalidation.

After every correction:

```text
Correct one cell
  ↓
Persist corrected cell
  ↓
Re-transform row
  ↓
Revalidate row
  ↓
Recalculate authoritative import counts
  ↓
Refresh the table
```

Other invalid cells remain visible and independently correctable.

## Large-data safety

Correction count updates use repository status aggregates instead of loading the complete dataset into the browser/server just to update headline metrics.

Automatic transformation audit metadata is stored per staged record and summarized in validation audit events without logging sensitive raw values unnecessarily.
