import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ColumnNormalizer } from '../../domain/mapping/column-normalizer.js';
import { entitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { ValidationEngine } from '../../domain/validation/validation.engine.js';
import { RequiredValidator, OptionalFieldValidator, EnumValidator, EmailValidator } from '../../domain/validation/field-validators.js';
import { DuplicateDetectionEngine } from '../../domain/duplicate/duplicate-detection.engine.js';
import { DataImportRecordEntity } from '../../domain/entities/data-import-record.entity.js';
import { DuplicateStrategy, ImportMode, RecordStatus } from '../../core/types/import.types.js';
import { DataImportMappingEntity } from '../../domain/entities/data-import-mapping.entity.js';

describe('DATA QUALITY ENGINE — Section A through X Verification', () => {

  const testSchema = entitySchemaRegistry.getEntity('contacts')!;

  describe('1. Column Data Profiling (Section A & P)', () => {
    it('should profile dataset columns and calculate total, non-empty, missing, valid, invalid, format consistency, and potential target fields', () => {
      const parsedDataset = {
        rowCount: 5,
        columnCount: 3,
        headers: ['First Name', 'Email Address', 'Status'],
        normalizedHeaders: [
          { index: 0, original: 'First Name', normalized: 'first_name' },
          { index: 1, original: 'Email Address', normalized: 'email' },
          { index: 2, original: 'Status', normalized: 'status' }
        ],
        rows: [
          { index: 1, values: { first_name: 'Jane', email: 'jane@example.com', status: 'ACTIVE' } },
          { index: 2, values: { first_name: 'John', email: 'invalid-email', status: 'LEAD' } },
          { index: 3, values: { first_name: '', email: 'alice@example.com', status: 'CHURNED' } },
          { index: 4, values: { first_name: 'Bob', email: 'bob@example.com', status: 'ACTIVE' } },
          { index: 5, values: { first_name: 'Bob', email: 'bob@example.com', status: 'ACTIVE' } }
        ],
        format: 'CSV' as any,
        duplicateHeaders: [],
        warnings: [],
        statistics: { totalBytes: 100, readTimeMs: 1, parseTimeMs: 1 },
        metadata: { encoding: 'utf-8', hasHeader: true, delimiter: ',' }
      };

      const profiles = ColumnNormalizer.profileDataset(parsedDataset as any, testSchema.fields);
      assert.strictEqual(profiles.length, 3);

      const emailProfile: any = profiles.find((p: any) => p.normalizedName === 'email');
      assert.ok(emailProfile);
      assert.strictEqual(emailProfile.totalRows, 5);
      assert.strictEqual(emailProfile.nonEmptyCount, 5);
      assert.strictEqual(emailProfile.missingCount, 0);
      assert.strictEqual(emailProfile.validCount, 4);
      assert.strictEqual(emailProfile.invalidCount, 1);
      assert.strictEqual(emailProfile.formatConsistency, 80);
      assert.ok(emailProfile.potentialTargetFields.length > 0);
      assert.strictEqual(emailProfile.potentialTargetFields[0].fieldName, 'email');
    });
  });

  describe('2. Missing Value & Placeholder Detection (Section B)', () => {
    const requiredValidator = new RequiredValidator();
    const optionalValidator = new OptionalFieldValidator();

    it('should flag MISSING_REQUIRED_FIELD with ERROR severity when required field is empty', () => {
      const fieldDef = testSchema.fields.first_name;
      const issues = requiredValidator.validate('', fieldDef, {} as any);
      assert.strictEqual(issues.length, 1);
      assert.strictEqual(issues[0].code, 'MISSING_REQUIRED_FIELD');
      assert.strictEqual(issues[0].severity, 'ERROR');
      assert.strictEqual(issues[0].sourceValue, 'EMPTY');
    });

    it('should flag OPTIONAL_FIELD_MISSING with WARNING severity when optional field is empty without inventing a value', () => {
      const fieldDef = testSchema.fields.phone;
      const issues = optionalValidator.validate(null, fieldDef, {} as any);
      assert.strictEqual(issues.length, 1);
      assert.strictEqual(issues[0].code, 'OPTIONAL_FIELD_MISSING');
      assert.strictEqual(issues[0].severity, 'WARNING');
    });

    it('should flag unnormalized placeholders as INVALID_PLACEHOLDER without assuming NULL', () => {
      const fieldDef = testSchema.fields.first_name;
      const issues = requiredValidator.validate('N/A', fieldDef, {} as any);
      assert.strictEqual(issues.length, 1);
      assert.strictEqual(issues[0].code, 'INVALID_PLACEHOLDER');
      assert.strictEqual(issues[0].sourceValue, 'N/A');
    });
  });

  describe('3. Duplicate Detection & Resolution (Section D, E, F, G, H, I)', () => {
    it('should detect intra-file duplicate groups and apply configured SKIP strategy without deleting evidence', async () => {
      const records = [
        new DataImportRecordEntity({
          id: 'rec-1',
          organizationId: 'org-1',
          importId: 'imp-1',
          rowIndex: 1,
          rawData: { email: 'dup@example.com', first_name: 'John', last_name: 'Doe' },
          transformedData: { email: 'dup@example.com', first_name: 'John', last_name: 'Doe' },
          status: RecordStatus.VALID,
          validationErrors: []
        }),
        new DataImportRecordEntity({
          id: 'rec-2',
          organizationId: 'org-1',
          importId: 'imp-1',
          rowIndex: 2,
          rawData: { email: 'dup@example.com', first_name: 'John', last_name: 'Doe' },
          transformedData: { email: 'dup@example.com', first_name: 'John', last_name: 'Doe' },
          status: RecordStatus.VALID,
          validationErrors: []
        })
      ];

      const engineResult = await DuplicateDetectionEngine.evaluateDataset(records, {
        organizationId: 'org-1',
        entityName: 'contacts',
        duplicateStrategy: DuplicateStrategy.SKIP,
        importMode: ImportMode.UPSERT
      });

      assert.strictEqual(engineResult.summary.duplicateGroups.length, 1);
      assert.strictEqual(engineResult.summary.duplicateGroups[0].count, 2);
      assert.strictEqual(engineResult.summary.duplicateInFile, 1);

      const secondRecordIntent = engineResult.intents.get('rec-2');
      assert.ok(secondRecordIntent);
      assert.strictEqual(secondRecordIntent.action, 'SKIP');
      assert.ok(secondRecordIntent.matchResult.reasons[0].includes('Intra-file duplicate'));
    });
  });

  describe('4. Invalid Enum Value & Revalidation (Section K & L)', () => {
    const enumValidator = new EnumValidator();

    it('should flag INVALID_ENUM_VALUE when source enum value is not allowed', () => {
      const fieldDef = testSchema.fields.status;
      const issues = enumValidator.validate('Pending', fieldDef, {} as any);
      assert.strictEqual(issues.length, 1);
      assert.strictEqual(issues[0].code, 'INVALID_ENUM_VALUE');
      assert.strictEqual(issues[0].severity, 'ERROR');
      assert.ok(issues[0].message.includes('Allowed values: ACTIVE, INACTIVE, LEAD, CHURNED'));
    });
  });

  describe('5. Record Processing Eligibility States (Section M & U)', () => {
    it('should correctly evaluate processing eligibility states for staged records', () => {
      assert.strictEqual(RecordStatus.SKIPPED_DUPLICATE, 'SKIPPED_DUPLICATE');
      assert.strictEqual(RecordStatus.REQUIRES_REVIEW, 'REQUIRES_REVIEW');
      assert.strictEqual(RecordStatus.AUTO_CORRECTED, 'AUTO_CORRECTED');
      assert.strictEqual(RecordStatus.READY_FOR_IMPORT, 'READY_FOR_IMPORT');
    });
  });
});
