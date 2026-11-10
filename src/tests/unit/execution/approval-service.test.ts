/**
 * Approval Service Unit Tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalService } from '../../../domain/services/approval.service.js';
import { InMemoryDataImportRepository } from '../../../infrastructure/repositories/in-memory-data-import.repository.js';
import { InMemoryDataImportMappingRepository } from '../../../infrastructure/repositories/in-memory-data-import-mapping.repository.js';
import { InMemoryDataImportRecordRepository } from '../../../infrastructure/repositories/in-memory-data-import-record.repository.js';
import { InMemoryDataImportApprovalRepository } from '../../../infrastructure/repositories/in-memory-data-import-approval.repository.js';
import { DataImportEntity } from '../../../domain/entities/data-import.entity.js';
import { DataImportRecordEntity } from '../../../domain/entities/data-import-record.entity.js';
import { DataImportMappingEntity } from '../../../domain/entities/data-import-mapping.entity.js';
import {
  ImportStatus,
  ImportSourceType,
  DuplicateStrategy,
  ErrorStrategy,
  RecordStatus,
  ApprovalStatus
} from '../../../core/types/import.types.js';
import {
  SecurityContext,
  DataImportPermission
} from '../../../core/types/permissions.types.js';
import { ForbiddenError } from '../../../core/errors/import.errors.js';

describe('ApprovalService Unit Tests', () => {
  let importRepo: InMemoryDataImportRepository;
  let mappingRepo: InMemoryDataImportMappingRepository;
  let recordRepo: InMemoryDataImportRecordRepository;
  let approvalRepo: InMemoryDataImportApprovalRepository;
  let service: ApprovalService;

  const orgId = 'org-appr-100';
  const uploaderId = 'user-uploader-1';
  const approverId = 'user-manager-2';

  const approverContext: SecurityContext = {
    userId: approverId,
    organizationId: orgId,
    roles: ['sales_manager'],
    permissions: [
      DataImportPermission.DATA_IMPORT_VIEW,
      DataImportPermission.DATA_IMPORT_APPROVE
    ]
  };

  const uploaderContext: SecurityContext = {
    userId: uploaderId,
    organizationId: orgId,
    roles: ['operator'],
    permissions: [
      DataImportPermission.DATA_IMPORT_VIEW,
      DataImportPermission.DATA_IMPORT_CREATE,
      DataImportPermission.DATA_IMPORT_APPROVE
    ]
  };

  beforeEach(() => {
    importRepo = new InMemoryDataImportRepository();
    mappingRepo = new InMemoryDataImportMappingRepository();
    recordRepo = new InMemoryDataImportRecordRepository();
    approvalRepo = new InMemoryDataImportApprovalRepository();

    service = new ApprovalService(
      importRepo,
      mappingRepo,
      recordRepo,
      approvalRepo
    );
  });

  it('keeps default imports ungated and requires approval for configured update mode', async () => {
    await importRepo.create(new DataImportEntity({
      id: 'imp-policy-standard',
      organizationId: orgId,
      name: 'Standard import',
      targetModule: 'crm',
      targetEntity: 'contacts',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.VALIDATED,
      createdBy: uploaderId,
      totalRecords: 2,
      importOptions: {
        duplicateStrategy: DuplicateStrategy.SKIP,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    }));
    await importRepo.create(new DataImportEntity({
      id: 'imp-policy-update',
      organizationId: orgId,
      name: 'Update import',
      targetModule: 'crm',
      targetEntity: 'contacts',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.VALIDATED,
      createdBy: uploaderId,
      totalRecords: 2,
      importOptions: {
        duplicateStrategy: DuplicateStrategy.UPDATE,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    }));

    assert.equal((await service.evaluateApprovalPolicy(orgId, 'imp-policy-standard')).requiresApproval, false);
    assert.equal((await service.evaluateApprovalPolicy(orgId, 'imp-policy-update')).requiresApproval, true);
  });

  it('should enforce separation of duties: uploader cannot approve their own import', async () => {
    const importJob = new DataImportEntity({
      id: 'imp-sod-1',
      organizationId: orgId,
      name: 'SoD Test Import',
      targetModule: 'crm',
      targetEntity: 'contacts',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.VALIDATED,
      createdBy: uploaderId,
      requiresApproval: true,
      fileMetadata: { duplicateSummary: { duplicateGroups: [] } },
      importOptions: {
        duplicateStrategy: DuplicateStrategy.SKIP,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    });
    await importRepo.create(importJob);
    await service.submitForApproval(uploaderContext, 'imp-sod-1');
    const uploaderAsApprover: SecurityContext = {
      ...uploaderContext,
      roles: ['sales_manager']
    };

    await assert.rejects(
      async () => {
        await service.approveImport(uploaderAsApprover, 'imp-sod-1', 'Self approval attempt');
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenError);
        assert.match(err.message, /Separation of duties violation/);
        return true;
      }
    );
  });

  it('should approve import and transition state to APPROVED with cryptographic snapshot hash', async () => {
    const importJob = new DataImportEntity({
      id: 'imp-appr-1',
      organizationId: orgId,
      name: 'Valid Approval Import',
      targetModule: 'crm',
      targetEntity: 'contacts',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.VALIDATED,
      createdBy: uploaderId,
      requiresApproval: true,
      fileMetadata: { duplicateSummary: { duplicateGroups: [] } },
      importOptions: {
        duplicateStrategy: DuplicateStrategy.SKIP,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    });
    await importRepo.create(importJob);

    const mapping = new DataImportMappingEntity({
      id: 'map-1',
      organizationId: orgId,
      importId: 'imp-appr-1',
      columnMappings: {
        'Email': { sourceColumn: 'Email', targetField: 'email', targetType: 'EMAIL', required: true }
      }
    });
    await mappingRepo.save(mapping);

    const record = new DataImportRecordEntity({
      id: 'rec-1',
      organizationId: orgId,
      importId: 'imp-appr-1',
      rowIndex: 1,
      rawData: { Email: 'test@example.com' },
      transformedData: { email: 'test@example.com' },
      status: RecordStatus.VALID
    });
    await recordRepo.saveBatch([record]);

    await service.submitForApproval(uploaderContext, 'imp-appr-1');
    const approval = await service.approveImport(approverContext, 'imp-appr-1', 'Approved for production');

    assert.equal(approval.decision, ApprovalStatus.APPROVED);
    assert.equal(approval.decidedBy, approverId);
    assert.ok(approval.snapshotHash.length === 64); // SHA-256

    const updatedJob = await importRepo.findById(orgId, 'imp-appr-1');
    assert.equal(updatedJob?.status, ImportStatus.APPROVED);
  });

  it('should reject import and transition state to REJECTED with reason', async () => {
    const importJob = new DataImportEntity({
      id: 'imp-rej-1',
      organizationId: orgId,
      name: 'Reject Test Import',
      targetModule: 'crm',
      targetEntity: 'contacts',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.VALIDATED,
      createdBy: uploaderId,
      requiresApproval: true,
      fileMetadata: { duplicateSummary: { duplicateGroups: [] } },
      importOptions: {
        duplicateStrategy: DuplicateStrategy.SKIP,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    });
    await importRepo.create(importJob);

    await service.submitForApproval(uploaderContext, 'imp-rej-1');
    const approval = await service.rejectImport(approverContext, 'imp-rej-1', 'Data quality substandard');

    assert.equal(approval.decision, ApprovalStatus.REJECTED);
    assert.equal(approval.reason, 'Data quality substandard');

    const updatedJob = await importRepo.findById(orgId, 'imp-rej-1');
    assert.equal(updatedJob?.status, ImportStatus.REJECTED);
  });
});
