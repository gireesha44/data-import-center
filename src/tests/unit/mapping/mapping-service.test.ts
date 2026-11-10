/**
 * Unit Tests: Mapping Service
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MappingService } from '../../../domain/services/mapping.service.js';
import { InMemoryDataImportRepository } from '../../../infrastructure/repositories/in-memory-data-import.repository.js';
import { InMemoryDataImportMappingRepository } from '../../../infrastructure/repositories/in-memory-data-import-mapping.repository.js';
import { entitySchemaRegistry } from '../../../core/registry/entity-schema.registry.js';
import { auditService } from '../../../infrastructure/services/audit.service.js';
import { DataImportEntity } from '../../../domain/entities/data-import.entity.js';
import { ImportStatus } from '../../../core/types/import.types.js';
import { SecurityContext, DataImportPermission } from '../../../core/types/permissions.types.js';
import { ForbiddenError } from '../../../core/errors/import.errors.js';

describe('MappingService', () => {
  let importRepo: InMemoryDataImportRepository;
  let mappingRepo: InMemoryDataImportMappingRepository;
  let service: MappingService;

  const validContext: SecurityContext = {
    organizationId: 'org_acme',
    userId: 'user_1',
    roles: ['ADMIN'],
    permissions: [
      DataImportPermission.DATA_IMPORT_VIEW,
      DataImportPermission.DATA_IMPORT_MAP
    ]
  };

  const noPermContext: SecurityContext = {
    organizationId: 'org_acme',
    userId: 'user_2',
    roles: ['GUEST'],
    permissions: []
  };

  beforeEach(() => {
    importRepo = new InMemoryDataImportRepository();
    mappingRepo = new InMemoryDataImportMappingRepository();
    service = new MappingService(
      importRepo,
      mappingRepo,
      entitySchemaRegistry,
      auditService
    );
  });

  it('should generate mapping suggestions for an import job with parsed headers', async () => {
    const importEntity = new DataImportEntity({
      id: 'import_101',
      organizationId: 'org_acme',
      targetModule: 'crm',
      targetEntity: 'contacts',
      name: 'Customer Contacts',
      status: ImportStatus.PARSED,
      createdBy: 'user_1',
      fileMetadata: {
        headers: ['First Name', 'Last Name', 'Email Address'],
        sampleRows: [{ 'first_name': 'John', 'last_name': 'Doe', 'email_address': 'j@d.com' }]
      }
    });
    await importRepo.create(importEntity);

    const suggestions = await service.getSuggestions(validContext, 'import_101');
    assert.equal(suggestions.totalSourceColumns, 3);
    assert.equal(suggestions.mappedCount, 3);
    assert.equal(suggestions.suggestions[0].suggestedTargetField, 'first_name');
    assert.equal(suggestions.suggestions[1].suggestedTargetField, 'last_name');
    assert.equal(suggestions.suggestions[2].suggestedTargetField, 'email');
  });

  it('should reject getSuggestions when caller lacks permissions', async () => {
    await assert.rejects(
      async () => service.getSuggestions(noPermContext, 'import_101'),
      ForbiddenError
    );
  });

  it('should save valid mapping and transition import status to MAPPED', async () => {
    const importEntity = new DataImportEntity({
      id: 'import_102',
      organizationId: 'org_acme',
      targetModule: 'crm',
      targetEntity: 'contacts',
      name: 'Customer Contacts',
      status: ImportStatus.PARSED,
      createdBy: 'user_1',
      fileMetadata: {
        headers: ['first_name', 'last_name', 'email'],
        sampleRows: [{ first_name: 'Jane', last_name: 'Doe', email: 'jane@doe.com' }]
      }
    });
    await importRepo.create(importEntity);

    const result = await service.saveMapping(validContext, 'import_102', {
      columnMappings: {
        first_name: { targetField: 'first_name', mappingMethod: 'MANUAL' },
        last_name: { targetField: 'last_name', mappingMethod: 'MANUAL' },
        email: { targetField: 'email', mappingMethod: 'MANUAL' }
      }
    });

    assert.equal(result.validation.isValid, true);

    const updatedJob = await importRepo.findById('org_acme', 'import_102');
    assert.equal(updatedJob?.status, ImportStatus.MAPPED);

    const savedMapping = await mappingRepo.findByImportId('org_acme', 'import_102');
    assert.ok(savedMapping);
    assert.equal(savedMapping.isValid, true);
  });

  it('should transition import to MAPPING if mapping is incomplete (missing required field)', async () => {
    const importEntity = new DataImportEntity({
      id: 'import_103',
      organizationId: 'org_acme',
      targetModule: 'crm',
      targetEntity: 'contacts',
      name: 'Incomplete Mapping Job',
      status: ImportStatus.PARSED,
      createdBy: 'user_1',
      fileMetadata: {
        headers: ['first_name'],
        sampleRows: [{ first_name: 'Jane' }]
      }
    });
    await importRepo.create(importEntity);

    const result = await service.saveMapping(validContext, 'import_103', {
      columnMappings: {
        first_name: { targetField: 'first_name', mappingMethod: 'MANUAL' }
      }
    });

    assert.equal(result.validation.isValid, false);
    assert.ok(result.validation.unmappedRequiredFields.includes('last_name'));
    assert.ok(result.validation.unmappedRequiredFields.includes('email'));

    const updatedJob = await importRepo.findById('org_acme', 'import_103');
    assert.equal(updatedJob?.status, ImportStatus.MAPPING);
  });

  it('should allow an operator to correct mapping after validation failure without losing the draft', async () => {
    const importEntity = new DataImportEntity({
      id: 'import_105',
      organizationId: 'org_acme',
      targetModule: 'crm',
      targetEntity: 'contacts',
      name: 'Validation Failed Correction',
      status: ImportStatus.VALIDATION_FAILED,
      createdBy: 'user_1',
      fileMetadata: {
        headers: ['first_name', 'last_name', 'email'],
        sampleRows: [{ first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' }]
      },
      totalRecords: 1,
      validRecords: 0,
      invalidRecords: 1
    });
    await importRepo.create(importEntity);

    const result = await service.saveMapping(validContext, 'import_105', {
      columnMappings: {
        first_name: { targetField: 'first_name' },
        last_name: { targetField: 'last_name' },
        email: { targetField: 'email', transformations: [{ type: 'TRIM' }] }
      }
    });

    assert.equal(result.validation.isValid, true);
    const updatedJob = await importRepo.findById('org_acme', 'import_105');
    assert.equal(updatedJob?.status, ImportStatus.MAPPED);

    const savedMapping = await mappingRepo.findByImportId('org_acme', 'import_105');
    assert.deepEqual(savedMapping?.transformations.email, [{ type: 'TRIM' }]);
  });

  it('should allow re-mapping when import is in VALIDATED state', async () => {
    const importEntity = new DataImportEntity({
      id: 'import_106',
      organizationId: 'org_acme',
      targetModule: 'crm',
      targetEntity: 'contacts',
      name: 'Validated Re-mapping',
      status: ImportStatus.VALIDATED,
      createdBy: 'user_1',
      fileMetadata: {
        headers: ['first_name', 'last_name', 'email'],
        sampleRows: [{ first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' }]
      },
      totalRecords: 1,
      validRecords: 1,
      invalidRecords: 0
    });
    await importRepo.create(importEntity);

    const result = await service.saveMapping(validContext, 'import_106', {
      columnMappings: {
        first_name: { targetField: 'first_name' },
        last_name: { targetField: 'last_name' },
        email: { targetField: 'email', transformations: [{ type: 'UPPERCASE' }] }
      }
    });

    assert.equal(result.validation.isValid, true);
    const updatedJob = await importRepo.findById('org_acme', 'import_106');
    assert.equal(updatedJob?.status, ImportStatus.MAPPED);

    const savedMapping = await mappingRepo.findByImportId('org_acme', 'import_106');
    assert.deepEqual(savedMapping?.transformations.email, [{ type: 'UPPERCASE' }]);
  });

  it('should clear mapping and revert status to PARSED', async () => {
    const importEntity = new DataImportEntity({
      id: 'import_104',
      organizationId: 'org_acme',
      targetModule: 'crm',
      targetEntity: 'contacts',
      name: 'To Clear',
      status: ImportStatus.MAPPED,
      createdBy: 'user_1',
      fileMetadata: { headers: ['first_name'], sampleRows: [] }
    });
    await importRepo.create(importEntity);

    await service.clearMapping(validContext, 'import_104');

    const updatedJob = await importRepo.findById('org_acme', 'import_104');
    assert.equal(updatedJob?.status, ImportStatus.PARSED);

    const savedMapping = await mappingRepo.findByImportId('org_acme', 'import_104');
    assert.equal(savedMapping, null);
  });
});
