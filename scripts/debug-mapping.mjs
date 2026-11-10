/**
 * Debug script: traces the full mapping flow and shows exact API shapes
 */
const BASE = 'http://localhost:3000/api/v1/data-imports';
const HEADERS = {
  'Content-Type': 'application/json',
  'x-organization-id': 'org-master-101',
  'x-user-id': 'user-admin-01',
  'x-user-roles': 'ADMIN',
  'x-user-permissions': 'DATA_IMPORT_VIEW,DATA_IMPORT_CREATE,DATA_IMPORT_UPLOAD,DATA_IMPORT_MAP,DATA_IMPORT_VALIDATE,DATA_IMPORT_EXECUTE,DATA_IMPORT_APPROVE,DATA_IMPORT_CANCEL'
};

async function api(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, { headers: HEADERS, ...opts });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j.data ?? j;
}

// Read demo CSV as buffer
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const __dir = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(__dir, '..', 'public', 'demo-files', 'data-import-demo-valid.csv');
const csvBuffer = readFileSync(csvPath);

console.log('======================================================');
console.log('MAPPING PIPELINE DEBUG TRACE');
console.log('======================================================\n');

// ── 1. Create import job ──────────────────────────────────────────────────────
console.log('STEP 1: Create Import Job (targetEntity=contacts)');
const job = await api('/', {
  method: 'POST',
  body: JSON.stringify({ name: 'Debug Mapping Test', targetEntity: 'contacts', description: 'Auto debug' })
});
console.log(`  ✅ Created: id=${job.id}  status=${job.status}  targetEntity=${job.targetEntity}\n`);

// ── 2. Upload file ────────────────────────────────────────────────────────────
console.log('STEP 2: Upload CSV File');
const uploadRes = await api(`/${job.id}/upload`, {
  method: 'POST',
  body: JSON.stringify({
    filename: 'data-import-demo-valid.csv',
    content: csvBuffer.toString('base64'),
    encoding: 'base64',
    mimeType: 'text/csv'
  })
});
console.log(`  ✅ Uploaded: ${JSON.stringify(uploadRes).slice(0, 120)}\n`);

// ── 3. Parse file ─────────────────────────────────────────────────────────────
console.log('STEP 3: Parse File');
const parseRes = await api(`/${job.id}/parse`, { method: 'POST' });
console.log(`  ✅ Parsed: rowCount=${parseRes.rowCount}  columnCount=${parseRes.columnCount}`);
console.log(`  Headers (raw):       ${JSON.stringify(parseRes.headers)}`);
console.log(`  NormalizedHeaders:   ${JSON.stringify(parseRes.normalizedHeaders?.map(h => h.normalized))}\n`);

// ── 4. Get mapping suggestions ────────────────────────────────────────────────
console.log('STEP 4: Get Mapping Suggestions');
const suggRes = await api(`/${job.id}/mapping/suggestions`);
console.log(`  Entity:        ${suggRes.entity}`);
console.log(`  totalSource:   ${suggRes.totalSourceColumns}`);
console.log(`  mappedCount:   ${suggRes.mappedCount}`);
console.log(`  unmappedCount: ${suggRes.unmappedCount}\n`);

console.log('  ── sourceColumns shape ──────────────────────────────');
for (const col of suggRes.sourceColumns) {
  console.log(`   col.originalName="${col.originalName}"  normalizedName="${col.normalizedName}"  inferredType=${col.inferredType}  samples=${JSON.stringify(col.sampleValues?.slice(0, 2))}`);
}

console.log('\n  ── suggestions shape ────────────────────────────────');
for (const s of suggRes.suggestions) {
  console.log(`   s.sourceColumn="${s.sourceColumn}"  suggestedTargetField="${s.suggestedTargetField}"  confidence=${s.confidence}  score=${s.confidenceScore}`);
}

// ── 5. Build mapping from suggestions ────────────────────────────────────────
console.log('\nSTEP 5: Build Mapping from Suggestions');
const mappings = suggRes.suggestions
  .filter(s => s.suggestedTargetField)
  .map(s => ({
    sourceColumn: s.sourceColumn,
    targetField: s.suggestedTargetField,
    transformations: [{ type: 'TRIM' }]
  }));

console.log(`  Built ${mappings.length} mappings:`);
for (const m of mappings) {
  console.log(`   "${m.sourceColumn}" → "${m.targetField}"`);
}

// ── 6. Validate mapping ───────────────────────────────────────────────────────
console.log('\nSTEP 6: Validate Mapping (dry-run)');
const valRes = await api(`/${job.id}/mapping/validate`, {
  method: 'POST',
  body: JSON.stringify({ mappings })
});
console.log(`  isValid:                 ${valRes.isValid}`);
console.log(`  mappedRequiredFields:    ${JSON.stringify(valRes.mappedRequiredFields)}`);
console.log(`  unmappedRequiredFields:  ${JSON.stringify(valRes.unmappedRequiredFields)}`);
console.log(`  errors:                  ${JSON.stringify(valRes.errors)}`);
console.log(`  warnings:                ${JSON.stringify(valRes.warnings)}`);

// ── 7. Save mapping ───────────────────────────────────────────────────────────
if (valRes.isValid) {
  console.log('\nSTEP 7: Save Mapping');
  const saveRes = await api(`/${job.id}/mapping`, {
    method: 'POST',
    body: JSON.stringify({ mappings })
  });
  console.log(`  ✅ Mapping saved. isValid=${saveRes.validation?.isValid}`);
} else {
  console.log('\n  ❌ MAPPING INVALID — skipping save');
}

console.log('\n======================================================');
console.log('WHAT THE FRONTEND MUST DO:');
console.log('  - Each dropdown data-col must equal: s.sourceColumn (from suggestions)');
console.log('  - Each option value must equal:      s.suggestedTargetField');
console.log('======================================================\n');
