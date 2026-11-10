import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { TemplateService } from '../../domain/services/template.service.js';
import { EntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { NotFoundError, ValidationError } from '../../core/errors/import.errors.js';

describe('TemplateService', () => {
  let registry: EntitySchemaRegistry;
  let templateService: TemplateService;

  beforeEach(() => {
    registry = new EntitySchemaRegistry();

    // Register Contacts Entity
    registry.registerEntity({
      module: 'crm',
      entity: 'contacts',
      displayName: 'Customer Contacts',
      version: 1,
      fields: {
        first_name: {
          name: 'first_name',
          label: 'First Name',
          type: 'STRING',
          required: true,
          example: 'Jane',
          aliases: ['fname', 'firstname']
        },
        last_name: {
          name: 'last_name',
          label: 'Last Name',
          type: 'STRING',
          required: true,
          example: 'Doe'
        },
        email: {
          name: 'email',
          label: 'Email Address',
          type: 'EMAIL',
          required: true,
          unique: true,
          example: 'jane.doe@example.com'
        },
        status: {
          name: 'status',
          label: 'Status',
          type: 'ENUM',
          required: false,
          enumValues: ['ACTIVE', 'INACTIVE', 'LEAD']
        },
        id: {
          name: 'id',
          label: 'System ID',
          type: 'IDENTIFIER',
          required: false,
          readOnly: true
        }
      },
      duplicateRules: []
    });

    templateService = new TemplateService(registry);
  });

  describe('getTemplateMetadata', () => {
    it('should return metadata excluding read-only fields', () => {
      const meta = templateService.getTemplateMetadata('contacts');
      assert.equal(meta.entity, 'contacts');
      assert.equal(meta.module, 'crm');
      assert.equal(meta.totalFields, 4); // first_name, last_name, email, status (id excluded)
      assert.equal(meta.requiredCount, 3);
      assert.equal(meta.optionalCount, 1);
      assert.deepEqual(meta.requiredFields, ['first_name', 'last_name', 'email']);
      assert.deepEqual(meta.optionalFields, ['status']);
      assert.equal(
        meta.fields.some((f) => f.name === 'id'),
        false
      );
    });

    it('should throw NotFoundError for unregistered entity', () => {
      assert.throws(() => templateService.getTemplateMetadata('unknown'), NotFoundError);
    });

    it('should throw ValidationError if entity name is empty', () => {
      assert.throws(() => templateService.getTemplateMetadata(''), ValidationError);
    });
  });

  describe('generateCsvTemplate', () => {
    it('should generate CSV content with correct header row and example values', () => {
      const csv = templateService.generateCsvTemplate('contacts');
      const lines = csv.trim().split('\n');
      assert.equal(lines.length, 2);
      assert.equal(lines[0], 'first_name,last_name,email,status');
      assert.equal(lines[1], 'Jane,Doe,jane.doe@example.com,');
    });

    it('should escape CSV values containing commas or quotes', () => {
      registry.registerEntity({
        module: 'test',
        entity: 'escaped_entity',
        displayName: 'Escaped Entity',
        version: 1,
        fields: {
          desc: {
            name: 'desc',
            label: 'Description',
            type: 'STRING',
            required: true,
            example: 'Hello, "World"'
          }
        },
        duplicateRules: []
      });

      const csv = templateService.generateCsvTemplate('escaped_entity');
      assert.ok(csv.includes('"Hello, ""World"""'));
    });
  });

  describe('generateXlsxTemplate', () => {
    it('should generate a valid XLSX workbook buffer with expected sheets', () => {
      const buffer = templateService.generateXlsxTemplate('contacts');
      assert.ok(buffer instanceof Buffer);
      assert.ok(buffer.length > 0);

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      assert.ok(workbook.SheetNames.includes('IMPORT_TEMPLATE'));
      assert.ok(workbook.SheetNames.includes('FIELD_GUIDE'));
      assert.ok(workbook.SheetNames.includes('ALLOWED_VALUES'));

      // Verify Sheet 1 Headers
      const importSheet = workbook.Sheets['IMPORT_TEMPLATE'];
      const importJson = XLSX.utils.sheet_to_json(importSheet);
      assert.equal(importJson.length, 1);
      assert.equal((importJson[0] as any).first_name, 'Jane');

      // Verify Sheet 2 Field Guide
      const guideSheet = workbook.Sheets['FIELD_GUIDE'];
      const guideJson = XLSX.utils.sheet_to_json(guideSheet);
      assert.equal(guideJson.length, 4);
      assert.equal((guideJson[0] as any)['Field Name'], 'first_name');

      // Verify Sheet 3 Allowed Values
      const enumSheet = workbook.Sheets['ALLOWED_VALUES'];
      const enumJson = XLSX.utils.sheet_to_json(enumSheet);
      assert.equal(enumJson.length, 3);
    });
  });

  describe('validateTemplateHeaders', () => {
    it('should return isValid true when all required fields are present', () => {
      const result = templateService.validateTemplateHeaders('contacts', [
        'first_name',
        'last_name',
        'email',
        'status'
      ]);
      assert.equal(result.isValid, true);
      assert.equal(result.missingRequired.length, 0);
      assert.equal(result.unknownFields.length, 0);
    });

    it('should accept field aliases for required fields', () => {
      const result = templateService.validateTemplateHeaders('contacts', [
        'fname',
        'last_name',
        'email'
      ]);
      assert.equal(result.isValid, true);
      assert.equal(result.missingRequired.length, 0);
    });

    it('should detect missing required fields', () => {
      const result = templateService.validateTemplateHeaders('contacts', ['first_name', 'status']);
      assert.equal(result.isValid, false);
      assert.deepEqual(result.missingRequired, ['last_name', 'email']);
    });

    it('should detect unknown fields not defined in schema', () => {
      const result = templateService.validateTemplateHeaders('contacts', [
        'first_name',
        'last_name',
        'email',
        'random_column'
      ]);
      assert.equal(result.isValid, true); // Still valid because required fields present
      assert.deepEqual(result.unknownFields, ['random_column']);
    });
  });
});
