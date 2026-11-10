/**
 * Unit Tests: Mapping Validator Service
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MappingValidatorService } from '../../../domain/mapping/mapping-validator.service.js';
import { entitySchemaRegistry } from '../../../core/registry/entity-schema.registry.js';
import { ColumnMapping, SourceColumn } from '../../../core/types/mapping.types.js';

describe('MappingValidatorService', () => {
  const contactsSchema = entitySchemaRegistry.getEntity('contacts')!;

  const sourceCols: SourceColumn[] = [
    { index: 0, originalName: 'First Name', normalizedName: 'first_name', inferredType: 'STRING', sampleValues: ['John'], emptyPercentage: 0 },
    { index: 1, originalName: 'Last Name', normalizedName: 'last_name', inferredType: 'STRING', sampleValues: ['Doe'], emptyPercentage: 0 },
    { index: 2, originalName: 'Email', normalizedName: 'email', inferredType: 'EMAIL', sampleValues: ['j@d.com'], emptyPercentage: 0 },
    { index: 3, originalName: 'Phone', normalizedName: 'phone', inferredType: 'PHONE', sampleValues: ['555-1234'], emptyPercentage: 0 }
  ];

  it('should validate complete and valid mapping', () => {
    const mappings: Record<string, ColumnMapping> = {
      'First Name': { sourceColumn: 'First Name', targetField: 'first_name', mappingMethod: 'MANUAL', confidence: 'HIGH', confidenceScore: 1, compatibility: 'COMPATIBLE', enabled: true },
      'Last Name': { sourceColumn: 'Last Name', targetField: 'last_name', mappingMethod: 'MANUAL', confidence: 'HIGH', confidenceScore: 1, compatibility: 'COMPATIBLE', enabled: true },
      'Email': { sourceColumn: 'Email', targetField: 'email', mappingMethod: 'MANUAL', confidence: 'HIGH', confidenceScore: 1, compatibility: 'COMPATIBLE', enabled: true },
      'Phone': { sourceColumn: 'Phone', targetField: 'phone', mappingMethod: 'MANUAL', confidence: 'HIGH', confidenceScore: 1, compatibility: 'COMPATIBLE', enabled: true }
    };

    const result = MappingValidatorService.validate(mappings, contactsSchema, sourceCols);

    assert.equal(result.isValid, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.unmappedRequiredFields.length, 0);
  });

  it('should fail when a required field is unmapped', () => {
    const mappings: Record<string, ColumnMapping> = {
      'First Name': { sourceColumn: 'First Name', targetField: 'first_name', mappingMethod: 'MANUAL', confidence: 'HIGH', confidenceScore: 1, compatibility: 'COMPATIBLE', enabled: true },
      // 'last_name' and 'email' omitted (both are required)
    };

    const result = MappingValidatorService.validate(mappings, contactsSchema, sourceCols);

    assert.equal(result.isValid, false);
    assert.ok(result.unmappedRequiredFields.includes('last_name'));
    assert.ok(result.unmappedRequiredFields.includes('email'));
    assert.ok(result.errors.some((e) => e.includes('last_name')));
  });

  it('should reject mapping unknown target field or unknown source column', () => {
    const mappings: Record<string, ColumnMapping> = {
      'First Name': { sourceColumn: 'First Name', targetField: 'unknown_nonexistent_field', mappingMethod: 'MANUAL', confidence: 'HIGH', confidenceScore: 1, compatibility: 'COMPATIBLE', enabled: true },
      'Ghost Column': { sourceColumn: 'Ghost Column', targetField: 'first_name', mappingMethod: 'MANUAL', confidence: 'HIGH', confidenceScore: 1, compatibility: 'COMPATIBLE', enabled: true }
    };

    const result = MappingValidatorService.validate(mappings, contactsSchema, sourceCols);

    assert.equal(result.isValid, false);
    assert.ok(result.issues.some((i) => i.code === 'UNKNOWN_TARGET_FIELD'));
    assert.ok(result.issues.some((i) => i.code === 'UNKNOWN_SOURCE_COLUMN'));
  });

  it('should reject mapping read-only fields', () => {
    const mappings: Record<string, ColumnMapping> = {
      'First Name': { sourceColumn: 'First Name', targetField: 'id', mappingMethod: 'MANUAL', confidence: 'HIGH', confidenceScore: 1, compatibility: 'COMPATIBLE', enabled: true }
    };

    const result = MappingValidatorService.validate(mappings, contactsSchema, sourceCols);

    assert.equal(result.isValid, false);
    assert.ok(result.issues.some((i) => i.code === 'READ_ONLY_FIELD_MAPPED'));
  });

  it('should reject duplicate assignments to the same target field', () => {
    const mappings: Record<string, ColumnMapping> = {
      'First Name': { sourceColumn: 'First Name', targetField: 'first_name', mappingMethod: 'MANUAL', confidence: 'HIGH', confidenceScore: 1, compatibility: 'COMPATIBLE', enabled: true },
      'Last Name': { sourceColumn: 'Last Name', targetField: 'first_name', mappingMethod: 'MANUAL', confidence: 'HIGH', confidenceScore: 1, compatibility: 'COMPATIBLE', enabled: true },
      'Email': { sourceColumn: 'Email', targetField: 'email', mappingMethod: 'MANUAL', confidence: 'HIGH', confidenceScore: 1, compatibility: 'COMPATIBLE', enabled: true }
    };

    const result = MappingValidatorService.validate(mappings, contactsSchema, sourceCols);

    assert.equal(result.isValid, false);
    assert.ok(result.issues.some((i) => i.code === 'DUPLICATE_TARGET_MAPPING'));
  });
});
