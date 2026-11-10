# Data Import Centre — File Ingestion, Storage, Parsing & Normalization (Phase 3)

## 1. Supported Formats

The Data Import Centre supports four primary data ingestion formats with strict format detection and validation:

| Format | Supported File Extensions | Supported MIME Types | Detection Strategy |
|---|---|---|---|
| **CSV** | `.csv`, `.tsv`, `.txt` | `text/csv`, `text/plain`, `application/vnd.ms-excel` | Header / text inspection, delimiter heuristic scoring |
| **Excel (XLSX)** | `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Magic byte check (`PK\x03\x04`), ZIP container validation |
| **Excel (Legacy XLS)**| `.xls` | `application/vnd.ms-excel` | OLE Compound Document Header (`\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1`) |
| **JSON** | `.json`, `.ndjson`, `.jsonl` | `application/json`, `application/x-ndjson` | Leading `[` or `{` check, JSON / NDJSON syntax parsing |
| **XML** | `.xml` | `application/xml`, `text/xml` | XML tag detection (`<...`), XMLValidator syntax checking |

---

## 2. Ingestion & Parsing Architecture

The file ingestion and parsing pipeline processes uploaded data through strict security layers before producing a parser-independent dataset:

```text
Upload Request
      ↓
Authentication & Tenant Resolution (Multi-Tenant Isolation)
      ↓
Authorization Guard (DATA_IMPORT_UPLOAD / DATA_IMPORT_PARSE)
      ↓
File Security & Magic Byte Validation (FileSecurityValidator)
      ↓
Secure Storage & Cryptographic Checksum (LocalFileStorageService)
      ↓
State Transition: DRAFT → UPLOADED (ImportStateMachine)
      ↓
Audit Log Recorded (IMPORT_FILE_UPLOADED)
      ↓
Parse Request (POST /:id/parse)
      ↓
Format Detection & Parser Selection (ParserFactory)
      ↓
Parser Execution (CsvParser, ExcelParser, JsonParser, XmlParser)
      ↓
Normalized Representation (ParsedDataset, NormalizedHeaders, ParsedRows)
      ↓
State Transition: UPLOADED → PARSING → PARSED
      ↓
Audit Log Recorded (IMPORT_PARSED)
      ↓
Preview-Ready API Response
```

---

## 3. Parser Interface Contract

All parsers adhere to the standard `IImportParser` contract located in [`src/core/types/parser.types.ts`](file:///src/core/types/parser.types.ts):

```typescript
export interface IImportParser {
  readonly format: ImportFileFormat;
  canParse(format: ImportFileFormat): boolean;
  parse(buffer: Buffer, options?: ParseOptions): Promise<ParsedDataset>;
}
```

Parser instances are registered and instantiated through the `ParserFactory`:
```typescript
export class ParserFactory {
  public static getParser(format: ImportFileFormat): IImportParser;
  public static registerParser(parser: IImportParser): void;
}
```

---

## 4. Normalized Data Structure

The parsing output is strictly decoupled from underlying file formats using standard TypeScript domain structures:

### `ParsedDataset`
```typescript
export interface ParsedDataset {
  format: ImportFileFormat;
  headers: string[];
  normalizedHeaders: NormalizedHeader[];
  duplicateHeaders: string[];
  rows: ParsedRow[];
  rowCount: number;
  columnCount: number;
  warnings: string[];
  statistics: ParseStatistics;
  metadata: Record<string, unknown>;
}
```

### `NormalizedHeader`
```typescript
export interface NormalizedHeader {
  original: string;
  normalized: string;
  index: number;
  isDuplicate: boolean;
  duplicateCount: number;
}
```

### `ParsedRow`
```typescript
export interface ParsedRow {
  rowNumber: number;
  values: Record<string, unknown>;
  raw?: unknown;
}
```

---

## 5. Storage Architecture

Files are managed via `IFileStorageService` with an enterprise-grade `LocalFileStorageService` implementation:
- **Tenant Isolation**: Files are partitioned by organization ID (`storage/imports/<organizationId>/<importId>/`).
- **Safe Keys**: Files are assigned cryptographically random UUID storage identifiers. The user-provided filename is never used as the filesystem path.
- **Path Traversal Protection**: Filenames containing `../`, `..\`, absolute paths, null bytes (`\0`), or encoded traversals are sanitized and neutralized.
- **Checksum Verification**: SHA-256 cryptographic hashes are calculated on upload to guarantee end-to-end data integrity.

---

## 6. Security Controls

1. **Executable Defense**: Uploads containing Windows PE (`MZ`) or Linux ELF binary headers are rejected immediately regardless of declared MIME type or extension.
2. **XXE / DTD Injection Defense**: XML payloads containing `<!DOCTYPE` with `SYSTEM`, `PUBLIC`, or `<!ENTITY` definitions are blocked with `SecurityViolationError` before parser processing.
3. **MIME / Extension Spoofing Defense**: Header content-type is checked against file signatures (magic bytes) to prevent masquerading.
4. **Tenant-Guarded File Access**: Users cannot access, parse, or overwrite files belonging to other organizations or unauthorized imports.
5. **No Script / Macro Evaluation**: Excel and spreadsheet parsers extract raw cell values without executing VBA macros, spreadsheet scripts, or external hyperlink references.

---

## 7. Configurable Size Limits

Limits are managed centrally in `ImportConfigService` and default to:
- `maxFileSize`: 100 MB (configurable up to multi-gigabytes)
- `maxRows`: 1,000,000 rows
- `maxColumns`: 500 columns
- `maxJsonNestingDepth`: 10 levels
- `maxXmlNestingDepth`: 10 levels
- `previewLimit`: 50 rows (default preview slice returned over API)

---

## 8. Encoding Handling

- **UTF-8 Support**: Full standard UTF-8 parsing across CSV, JSON, XML, and text streams.
- **UTF-8 BOM Removal**: Byte Order Marks (`0xFEFF`) are automatically detected and stripped without altering column values or record positions.
- **Configurable Fallbacks**: Encoding options (`utf-8`, `ascii`, `latin1`) can be supplied per parse request.

---

## 9. CSV Parsing Behavior

- **RFC 4180 Compliance**: Full support for quoted fields, multi-line values within quotes, and escaped quotes (`""`).
- **Delimiter Auto-Detection**: Heuristic scoring detects `,`, `;`, `\t`, and `|` deterministically based on row consistency.
- **Duplicate Headers**: Automatically disambiguated (e.g. `phone`, `phone_1`, `phone_2`) while preserving `original` header names for UI mapping.
- **Empty Headers**: Automatically assigned fallbacks (`column_1`, `column_2`) and recorded in parser warnings.

---

## 10. Excel Parsing Behavior

- **Multi-Sheet Discovery**: Inspects workbook metadata and returns all sheet names (`sheetNames`) in dataset metadata.
- **Worksheet Selection**: Supports targeted sheet parsing via `{ sheet: 'SheetName' }` or defaults safely to the first worksheet.
- **Empty Worksheets**: Gracefully handled, returning empty rows and appropriate warning messages.
- **Formula Evaluation**: Formulas are read as evaluated static values (`raw: true`) without invoking script runtimes.

---

## 11. JSON Parsing Behavior

- **Supported Formats**:
  - Array of Objects: `[ { "id": 1, "name": "A" }, { "id": 2, "name": "B" } ]`
  - Single Object: `{ "id": 1, "name": "A" }`
  - Object with Records Array: `{ "data": [ ... ] }`, `{ "items": [ ... ] }`, `{ "records": [ ... ] }`
  - Newline-Delimited JSON (NDJSON / JSONL)
- **Nested Object Normalization**: Nested objects are flattened into dot-notation headers (e.g. `customer.address.city`) up to the configured nesting depth.

---

## 12. XML Parsing Behavior

- **Safety**: Built on `fast-xml-parser` with `XMLValidator` syntax pre-validation and external entities disabled.
- **Repeating Elements**: Automatically discovers repeating child record elements within root document wrappers.
- **Attribute Preservation**: XML attributes (prefixed with `@_`) are extracted and normalized cleanly into row attributes.

---

## 13. Preview Foundation

The `/api/v1/data-imports/:id/parse` API returns:
- `headers`: Full list of detected headers.
- `normalizedHeaders`: Cleaned, unique header metadata with indices.
- `rows`: Bounded preview slice (configurable default: 50 rows).
- `rowCount`: Total count of rows in the parsed dataset.
- `columnCount`: Total number of columns.
- `warnings`: Actionable warnings (e.g. empty headers, duplicate disambiguation, default sheet selection).

---

## 14. Standardized Parser Errors

All parser errors use the centralized Phase 2 error hierarchy:
- `UNSUPPORTED_FILE_FORMAT` / `INVALID_FILE_TYPE`
- `FILE_TOO_LARGE` / `ROW_LIMIT_EXCEEDED` / `COLUMN_LIMIT_EXCEEDED`
- `XML_EXTERNAL_ENTITY_BLOCKED`
- `VALIDATION_ERROR` (syntax error, empty buffer, malformed document)
- `STORAGE_ERROR` (disk write / read failure)

---

## 15. Performance Considerations

- **Streaming / Chunked Reading Ready**: File storage uses chunked write streams.
- **In-Memory Buffering Bounds**: Parsing enforces upper file size and row bounds early before full expansion.
- **Controlled Previews**: Memory-efficient slicing of preview data prevents API payload exhaustion.

---

## 16. Cleanup & Retention Strategy

- Storage keys are associated with `importId` and `organizationId`.
- Uploaded files in temporary storage can be purged on import cancellation, import completion, or via time-based retention policies.

---

## 17. Automated Verification & Testing

The Phase 3 implementation is verified by **80 automated tests** covering:
- **Unit Tests**:
  - `CsvParser`: Standard parsing, delimiter auto-detection (`,`, `;`, `\t`), quotes/newlines, BOM stripping, duplicate header disambiguation, preview limits.
  - `ExcelParser`: Single/multi-sheet discovery & selection, empty sheet handling, formula static value extraction.
  - `JsonParser`: Array of objects, dot-notation flattening, NDJSON/JSONL, object wrappers, malformed JSON rejection.
  - `XmlParser`: Repeating record parsing, XXE/DOCTYPE blocking, malformed XML rejection.
  - `FileSecurityValidator`: MIME/magic byte verification, executable binary blocking, size limit enforcement, empty file rejection, XXE payload blocking.
  - `LocalFileStorageService`: Path traversal sanitization, SHA-256 hash generation, tenant-partitioned storage.
  - `ImportStateMachine`: State transitions (`DRAFT` → `UPLOADED` → `PARSING` → `PARSED`), cancellation invariants.
- **Integration Tests**:
  - Full end-to-end API flows for CSV, Excel (XLSX), JSON, and XML ingestion and parsing.
  - Multi-tenant boundary enforcement (cannot access or parse another tenant's files).
  - RBAC permission guards (`DATA_IMPORT_UPLOAD`, `DATA_IMPORT_PARSE`).
  - Missing file / invalid state transition error handling.

---

## 18. Known Limitations

1. **Excel Formats**: Focus is on `.xlsx` (OpenXML) and `.xls` (BIFF8). Password-protected workbooks are rejected with a clear validation error.
2. **Streaming Parser Workers**: For ultra-large files (>100MB / >1M rows), background worker processing (Phase 7) will stream records directly to SQLite/PostgreSQL tables.
