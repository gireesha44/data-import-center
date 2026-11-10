import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ValidationService } from '../../../domain/services/validation.service.js';
import { InMemoryDataImportRepository } from '../../../infrastructure/repositories/in-memory-data-import.repository.js';
import { InMemoryDataImportMappingRepository } from '../../../infrastructure/repositories/in-memory-data-import-mapping.repository.js';
import { InMemoryDataImportRecordRepository } from '../../../infrastructure/repositories/in-memory-data-import-record.repository.js';
import { entitySchemaRegistry } from '../../../core/registry/entity-schema.registry.js';
import { auditService } from '../../../infrastructure/services/audit.service.js';
import { SecurityContext, DataImportPermission } from '../../../core/types/permissions.types.js';
import { ImportStatus, RecordStatus } from '../../../core/types/import.types.js';
import { DataImportEntity } from '../../../domain/entities/data-import.entity.js';
import { DataImportMappingEntity } from '../../../domain/entities/data-import-mapping.entity.js';
import { DataImportRecordEntity } from '../../../domain/entities/data-import-record.entity.js';

describe('ValidationService Unit Tests', () => {
  let importRepo: InMemoryDataImportRepository;
  let mappingRepo: InMemoryDataImportMappingRepository;
  let recordRepo: InMemoryDataImportRecordRepository;
  let validationService: ValidationService;

  const mockSecurityContext: SecurityContext = {
    userId: 'user-123',
    organizationId: 'org-456',
    roles: ['admin'],
    permissions: [
      DataImportPermission.DATA_IMPORT_VIEW,
      DataImportPermission.DATA_IMPORT_CREATE,
      DataImportPermission.DATA_IMPORT_VALIDATE,
      DataImportPermission.DATA_IMPORT_MAP
    ]
  };

  beforeEach(() => {
    importRepo = new InMemoryDataImportRepository();
    mappingRepo = new InMemoryDataImportMappingRepository();
    recordRepo = new InMemoryDataImportRecordRepository();
    validationService = new ValidationService(
      importRepo,
      mappingRepo,
      recordRepo,
      entitySchemaRegistry,
      auditService
    );
  });

  it('excludes duplicate and review-only records from validation attention results', async () => {
    await recordRepo.saveBatch([
      new DataImportRecordEntity({
        id: 'review-only',
        organizationId: mockSecurityContext.organizationId,
        importId: 'imp-attention-filter',
        rowIndex: 1,
        rawData: {},
        status: RecordStatus.REQUIRES_REVIEW,
        isBlocked: true,
        isDuplicate: true
      }),
      new DataImportRecordEntity({
        id: 'validation-error',
        organizationId: mockSecurityContext.organizationId,
        importId: 'imp-attention-filter',
        rowIndex: 2,
        rawData: {},
        status: RecordStatus.INVALID,
        validationErrors: [{
          field: 'email',
          code: 'INVALID_EMAIL',
          message: 'Invalid email address',
          severity: 'ERROR'
        }]
      })
    ]);

    const result = await recordRepo.findByImportId(
      mockSecurityContext.organizationId,
      'imp-attention-filter',
      { requiresAction: true }
    );

    assert.deepEqual(result.data.map((record) => record.id), ['validation-error']);
    assert.equal(result.pagination.total, 1);
  });

  it('transforms, validates, stages records and transitions import state to VALIDATED', async () => {
    // 1. Setup import in MAPPED state with parsed metadata
    const importJob = new DataImportEntity({
      id: 'imp_valid_1',
      organizationId: mockSecurityContext.organizationId,
      name: 'Contacts Import',
      targetModule: 'crm',
      targetEntity: 'contacts',
      status: ImportStatus.MAPPED,
      createdBy: mockSecurityContext.userId,
      fileMetadata: {
        totalRows: 2,
        columns: ['first_name', 'last_name', 'email'],
        headers: ['first_name', 'last_name', 'email'],
        sampleRows: [
          { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
          { first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' }
        ]
      }
    });
    await importRepo.create(importJob);

    // 2. Setup mapping
    const mapping = new DataImportMappingEntity({
      id: 'map_valid_1',
      importId: importJob.id,
      organizationId: mockSecurityContext.organizationId,
      columnMappings: {
        first_name: { sourceColumn: 'first_name', targetField: 'first_name', targetType: 'STRING', required: true },
        last_name: { sourceColumn: 'last_name', targetField: 'last_name', targetType: 'STRING', required: true },
        email: { sourceColumn: 'email', targetField: 'email', targetType: 'EMAIL', required: true }
      }
    });
    await mappingRepo.save(mapping);

    // 3. Execute validation
    const summary = await validationService.validateImport(mockSecurityContext, importJob.id);

    assert.equal(summary.totalRows, 2);
    assert.equal(summary.validRows, 2);
    assert.equal(summary.invalidRows, 0);

    const updatedJob = await importRepo.findById(mockSecurityContext.organizationId, importJob.id);
    assert.ok(updatedJob);
    assert.equal(updatedJob.status, ImportStatus.VALIDATED);

    // 4. Verify staged records
    const preview = await validationService.getValidationPreview(mockSecurityContext, importJob.id, {
      page: 1,
      limit: 10
    });

    assert.equal(preview.data.length, 2);
    assert.equal(preview.data[0].status, RecordStatus.VALID);
    assert.ok(preview.data[0].transformedData);
    assert.equal(preview.data[0].transformedData['first_name'], 'John');

    const corrected = await validationService.correctRecordFields(
      mockSecurityContext,
      importJob.id,
      preview.data[0].id,
      { first_name: 'Johnny', last_name: 'Corrected Doe' }
    );
    assert.equal(corrected.record.transformedData?.first_name, 'Johnny');
    assert.equal(corrected.record.transformedData?.last_name, 'Corrected Doe');
    assert.equal(corrected.record.status, RecordStatus.VALID);
    const correctionAudit = (await auditService.getImportAuditTrail(
      mockSecurityContext.organizationId,
      importJob.id
    )).find((event) => event.action === 'RECORD_CORRECTED');
    assert.deepEqual(correctionAudit?.details.originalValues, {
      first_name: 'John',
      last_name: 'Doe'
    });
    assert.deepEqual(correctionAudit?.details.editedValues, {
      first_name: 'Johnny',
      last_name: 'Corrected Doe'
    });
  });

  it('transitions import state to VALIDATION_FAILED when critical errors exist and records are invalid', async () => {
    const importJob = new DataImportEntity({
      id: 'imp_invalid_1',
      organizationId: mockSecurityContext.organizationId,
      name: 'Invalid Contacts Import',
      targetModule: 'crm',
      targetEntity: 'contacts',
      status: ImportStatus.MAPPED,
      createdBy: mockSecurityContext.userId,
      fileMetadata: {
        totalRows: 1,
        columns: ['first_name', 'email'],
        headers: ['first_name', 'email'],
        sampleRows: [
          { first_name: 'John', email: 'invalid-email-address' } // missing required last_name and invalid email
        ]
      }
    });
    await importRepo.create(importJob);

    const mapping = new DataImportMappingEntity({
      id: 'map_invalid_1',
      importId: importJob.id,
      organizationId: mockSecurityContext.organizationId,
      columnMappings: {
        first_name: { sourceColumn: 'first_name', targetField: 'first_name', targetType: 'STRING', required: true },
        email: { sourceColumn: 'email', targetField: 'email', targetType: 'EMAIL', required: true }
      }
    });
    await mappingRepo.save(mapping);

    const summary = await validationService.validateImport(mockSecurityContext, importJob.id);

    assert.equal(summary.invalidRows, 1);
    assert.ok(summary.errorCount >= 2);

    const updatedJob = await importRepo.findById(mockSecurityContext.organizationId, importJob.id);
    assert.ok(updatedJob);
    assert.equal(updatedJob.status, ImportStatus.VALIDATION_FAILED);
  });

  it('allows revalidation from VALIDATED and clears stale staged records when there is nothing to validate', async () => {
    const importJob = new DataImportEntity({
      id: 'imp_revalidate_empty',
      organizationId: mockSecurityContext.organizationId,
      name: 'Revalidated Contacts Import',
      targetModule: 'sales',
      targetEntity: 'contacts',
      status: ImportStatus.MAPPED,
      createdBy: mockSecurityContext.userId,
      fileMetadata: {
        sampleRows: [
          { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
          { first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' }
        ]
      }
    });
    await importRepo.create(importJob);
    await mappingRepo.save(new DataImportMappingEntity({
      id: 'map_revalidate_empty',
      importId: importJob.id,
      organizationId: mockSecurityContext.organizationId,
      columnMappings: {
        first_name: { sourceColumn: 'first_name', targetField: 'first_name', targetType: 'STRING', required: true },
        last_name: { sourceColumn: 'last_name', targetField: 'last_name', targetType: 'STRING', required: true },
        email: { sourceColumn: 'email', targetField: 'email', targetType: 'EMAIL', required: true }
      }
    }));

    const firstSummary = await validationService.validateImport(mockSecurityContext, importJob.id);
    assert.equal(firstSummary.totalRows, 2);
    assert.equal((await recordRepo.findByImportId(mockSecurityContext.organizationId, importJob.id)).data.length, 2);

    importJob.fileMetadata = { ...importJob.fileMetadata, sampleRows: [] };
    await importRepo.update(importJob);

    const secondSummary = await validationService.validateImport(mockSecurityContext, importJob.id);
    const updatedJob = await importRepo.findById(mockSecurityContext.organizationId, importJob.id);
    const preview = await recordRepo.findByImportId(mockSecurityContext.organizationId, importJob.id);

    assert.equal(secondSummary.totalRows, 0);
    assert.equal(secondSummary.validRows, 0);
    assert.equal(secondSummary.invalidRows, 0);
    assert.ok(updatedJob);
    assert.equal(updatedJob.status, ImportStatus.VALIDATED);
    assert.equal(updatedJob.totalRecords, 0);
    assert.equal(preview.data.length, 0);
  });
});
