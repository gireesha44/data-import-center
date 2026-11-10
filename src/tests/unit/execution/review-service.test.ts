/**
 * Review Service Unit Tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ReviewService } from '../../../domain/services/review.service.js';
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
  RecordStatus
} from '../../../core/types/import.types.js';
import {
  SecurityContext,
  DataImportPermission
} from '../../../core/types/permissions.types.js';
import { ReviewReadiness } from '../../../core/types/execution.types.js';
import { MatchClassification, ExecutionIntentAction } from '../../../core/types/duplicate.types.js';

describe('ReviewService Unit Tests', () => {
  let importRepo: InMemoryDataImportRepository;
  let mappingRepo: InMemoryDataImportMappingRepository;
  let recordRepo: InMemoryDataImportRecordRepository;
  let approvalRepo: InMemoryDataImportApprovalRepository;
  let approvalService: ApprovalService;
  let reviewService: ReviewService;

  const orgId = 'org-rev-100';
  const userId = 'user-reviewer-1';

  const context: SecurityContext = {
    userId,
    organizationId: orgId,
    roles: ['admin'],
    permissions: [
      DataImportPermission.DATA_IMPORT_VIEW,
      DataImportPermission.DATA_IMPORT_APPROVE
    ]
  };

  beforeEach(() => {
    importRepo = new InMemoryDataImportRepository();
    mappingRepo = new InMemoryDataImportMappingRepository();
    recordRepo = new InMemoryDataImportRecordRepository();
    approvalRepo = new InMemoryDataImportApprovalRepository();

    approvalService = new ApprovalService(
      importRepo,
      mappingRepo,
      recordRepo,
      approvalRepo
    );

    reviewService = new ReviewService(
      importRepo,
      mappingRepo,
      recordRepo,
      approvalService
    );
  });

  it('should evaluate the concise checklist and mark import READY when prerequisites are satisfied', async () => {
    // Products entity (does not mandate approval by default)
    const importJob = new DataImportEntity({
      id: 'imp-rev-ready',
      organizationId: orgId,
      name: 'Ready Products Import',
      targetModule: 'inventory',
      targetEntity: 'products',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.VALIDATED,
      createdBy: userId,
      importOptions: {
        duplicateStrategy: DuplicateStrategy.SKIP,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    });
    await importRepo.create(importJob);

    // Complete Mapping (required: sku, name, price)
    const mapping = new DataImportMappingEntity({
      id: 'map-p-1',
      organizationId: orgId,
      importId: 'imp-rev-ready',
      columnMappings: {
        'SKU': { sourceColumn: 'SKU', targetField: 'sku', targetType: 'STRING', required: true },
        'Name': { sourceColumn: 'Name', targetField: 'name', targetType: 'STRING', required: true },
        'Price': { sourceColumn: 'Price', targetField: 'price', targetType: 'NUMBER', required: true }
      }
    });
    await mappingRepo.save(mapping);

    // Seed 1 Valid Record with matching completed
    const record = new DataImportRecordEntity({
      id: 'rec-p1',
      organizationId: orgId,
      importId: 'imp-rev-ready',
      rowIndex: 1,
      rawData: { SKU: 'SKU-101', Name: 'Widget', Price: '19.99' },
      transformedData: { sku: 'SKU-101', name: 'Widget', price: 19.99 },
      status: RecordStatus.VALID,
      matchClassification: MatchClassification.NEW,
      executionAction: ExecutionIntentAction.CREATE
    });
    await recordRepo.saveBatch([record]);

    const review = await reviewService.getReviewSummary(context, 'imp-rev-ready');

    assert.equal(review.readiness, ReviewReadiness.READY);
    assert.equal(review.readinessLabel, 'READY FOR IMPORT');
    assert.equal(review.blockingIssues.length, 0);
    assert.equal(review.plannedCreates, 1);
    assert.equal(review.itemsNeedingReview, 0);
    assert.equal(review.unresolvedValidationErrors, 0);
    assert.equal(review.plannedFailed, 0);
    assert.equal(review.checklist.every((c) => c.passed), true);
  });

  it('should mark imports with missing required mappings as blocked while keeping approval as a separate step', async () => {
    const importJob = new DataImportEntity({
      id: 'imp-rev-blocked',
      organizationId: orgId,
      name: 'Incomplete Contacts Import',
      targetModule: 'crm',
      targetEntity: 'contacts', // Contacts entity mandates approval by default policy
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.VALIDATED,
      createdBy: 'someone-else',
      requiresApproval: true,
      importOptions: {
        duplicateStrategy: DuplicateStrategy.SKIP,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    });
    await importRepo.create(importJob);

    // Incomplete mapping (missing first_name, last_name)
    const mapping = new DataImportMappingEntity({
      id: 'map-c-1',
      organizationId: orgId,
      importId: 'imp-rev-blocked',
      columnMappings: {
        'Email': { sourceColumn: 'Email', targetField: 'email', targetType: 'EMAIL', required: true }
      }
    });
    await mappingRepo.save(mapping);

    const record = new DataImportRecordEntity({
      id: 'rec-c1',
      organizationId: orgId,
      importId: 'imp-rev-blocked',
      rowIndex: 1,
      rawData: { Email: 'alice@corp.com' },
      transformedData: { email: 'alice@corp.com' },
      status: RecordStatus.VALID,
      matchClassification: MatchClassification.NEW,
      executionAction: ExecutionIntentAction.CREATE
    });
    await recordRepo.saveBatch([record]);

    const review = await reviewService.getReviewSummary(context, 'imp-rev-blocked');

    assert.equal(review.readiness, ReviewReadiness.BLOCKED);
    assert.equal(review.readinessLabel, 'ACTION REQUIRED');
    assert.equal(review.requiresApproval, true);
    assert.equal(review.approvalStatus, 'NOT_REQUIRED');
    assert.ok(review.blockingIssues.some((issue) => issue.includes('mandatory field mappings')));
    assert.equal(review.checklist.some((item) => item.code === 'APPROVAL_SATISFIED'), false);
    assert.equal(review.checklist.find((item) => item.code === 'NO_BLOCKING_CONFLICTS')?.passed, false);
  });

  it('counts only unresolved rows as items needing review', async () => {
    const importJob = new DataImportEntity({
      id: 'imp-rev-actionable-only',
      organizationId: orgId,
      name: 'Actionable Review Count',
      targetModule: 'inventory',
      targetEntity: 'products',
      fileName: 'products.csv',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.VALIDATED,
      createdBy: userId,
      importOptions: {
        duplicateStrategy: DuplicateStrategy.SKIP,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    });
    await importRepo.create(importJob);
    await mappingRepo.save(new DataImportMappingEntity({
      id: 'map-actionable-only',
      organizationId: orgId,
      importId: importJob.id,
      columnMappings: {
        SKU: { sourceColumn: 'SKU', targetField: 'sku', targetType: 'STRING', required: true },
        Name: { sourceColumn: 'Name', targetField: 'name', targetType: 'STRING', required: true },
        Price: { sourceColumn: 'Price', targetField: 'price', targetType: 'NUMBER', required: true }
      }
    }));
    await recordRepo.saveBatch([
      new DataImportRecordEntity({
        id: 'rec-actionable-valid',
        organizationId: orgId,
        importId: importJob.id,
        rowIndex: 1,
        rawData: { SKU: 'SKU-101', Name: 'Widget', Price: '19.99' },
        transformedData: { sku: 'SKU-101', name: 'Widget', price: 19.99 },
        status: RecordStatus.VALID,
        matchClassification: MatchClassification.NEW,
        executionAction: ExecutionIntentAction.CREATE
      }),
      new DataImportRecordEntity({
        id: 'rec-actionable-invalid',
        organizationId: orgId,
        importId: importJob.id,
        rowIndex: 2,
        rawData: { SKU: '', Name: 'Missing SKU', Price: '19.99' },
        transformedData: { sku: '', name: 'Missing SKU', price: 19.99 },
        status: RecordStatus.INVALID,
        validationErrors: [{
          field: 'sku',
          code: 'REQUIRED',
          message: 'SKU is required',
          severity: 'ERROR'
        }],
        matchClassification: MatchClassification.INVALID,
        executionAction: ExecutionIntentAction.BLOCKED
      })
    ]);

    const review = await reviewService.getReviewSummary(context, importJob.id);
    assert.equal(review.itemsNeedingReview, 1);
    assert.equal(review.unresolvedValidationErrors, 1);
    assert.equal(review.plannedCreates, 1);
    assert.equal(review.readinessLabel, 'ACTION REQUIRED');
  });

  it('ignores stale duplicate group actions when persisted record actions are resolved', async () => {
    const importJob = new DataImportEntity({
      id: 'imp-rev-stale-duplicate-action',
      organizationId: orgId,
      name: 'Resolved Duplicate Import',
      targetModule: 'inventory',
      targetEntity: 'products',
      fileName: 'products.csv',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.VALIDATED,
      createdBy: userId,
      fileMetadata: {
        duplicateSummary: {
          duplicateGroups: [{
            records: [{
              recordId: 'rec-resolved-duplicate',
              resolutionAction: ExecutionIntentAction.REVIEW
            }]
          }]
        }
      },
      importOptions: {
        duplicateStrategy: DuplicateStrategy.SKIP,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    });
    await importRepo.create(importJob);
    await mappingRepo.save(new DataImportMappingEntity({
      id: 'map-stale-duplicate-action',
      organizationId: orgId,
      importId: importJob.id,
      columnMappings: {
        SKU: { sourceColumn: 'SKU', targetField: 'sku', targetType: 'STRING', required: true },
        Name: { sourceColumn: 'Name', targetField: 'name', targetType: 'STRING', required: true },
        Price: { sourceColumn: 'Price', targetField: 'price', targetType: 'NUMBER', required: true }
      }
    }));
    await recordRepo.saveBatch([new DataImportRecordEntity({
      id: 'rec-resolved-duplicate',
      organizationId: orgId,
      importId: importJob.id,
      rowIndex: 1,
      rawData: { SKU: 'SKU-201', Name: 'Resolved', Price: '19.99' },
      transformedData: { sku: 'SKU-201', name: 'Resolved', price: 19.99 },
      status: RecordStatus.VALID,
      matchClassification: MatchClassification.NEW,
      executionAction: ExecutionIntentAction.CREATE
    })]);

    const review = await reviewService.getReviewSummary(context, importJob.id);

    assert.equal(review.readiness, ReviewReadiness.READY);
    assert.equal(review.unresolvedDuplicates, 0);
    assert.equal(review.itemsNeedingReview, 0);
    assert.equal(review.checklist.find(item => item.code === 'DUPLICATE_DETECTION_COMPLETED')?.passed, true);
  });

  it('should return paginated review records and single record detail with diffs', async () => {
    const importJob = new DataImportEntity({
      id: 'imp-rev-detail',
      organizationId: orgId,
      name: 'Detail Test Import',
      targetModule: 'inventory',
      targetEntity: 'products',
      sourceType: ImportSourceType.FILE_UPLOAD,
      status: ImportStatus.VALIDATED,
      createdBy: userId,
      importOptions: {
        duplicateStrategy: DuplicateStrategy.SKIP,
        errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR
      }
    });
    await importRepo.create(importJob);

    const mapping = new DataImportMappingEntity({
      id: 'map-det-1',
      organizationId: orgId,
      importId: 'imp-rev-detail',
      columnMappings: {
        'Price': { sourceColumn: 'Price', targetField: 'price', targetType: 'NUMBER', required: true }
      }
    });
    await mappingRepo.save(mapping);

    const record = new DataImportRecordEntity({
      id: 'rec-det-1',
      organizationId: orgId,
      importId: 'imp-rev-detail',
      rowIndex: 1,
      rawData: { Price: '$19.99' },
      transformedData: { price: 19.99 },
      status: RecordStatus.VALID,
      matchClassification: MatchClassification.NEW,
      executionAction: ExecutionIntentAction.CREATE
    });
    await recordRepo.saveBatch([record]);

    const listRes = await reviewService.getReviewRecords(context, 'imp-rev-detail');
    assert.equal(listRes.data.length, 1);

    const detailRes = await reviewService.getRecordDetail(context, 'imp-rev-detail', 'rec-det-1');
    assert.equal(detailRes.id, 'rec-det-1');
    assert.equal(detailRes.fieldComparisons.length, 1);
    assert.equal(detailRes.fieldComparisons[0].hasChanged, true);
    assert.equal(detailRes.fieldComparisons[0].rawValue, '$19.99');
    assert.equal(detailRes.fieldComparisons[0].transformedValue, 19.99);
  });
});
