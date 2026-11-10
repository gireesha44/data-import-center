/**
 * Duplicate Detection Engine Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DuplicateDetectionEngine } from '../../../domain/duplicate/duplicate-detection.engine.js';
import { DataImportRecordEntity } from '../../../domain/entities/data-import-record.entity.js';
import { InMemoryTargetMatchProvider } from '../../../infrastructure/matching/in-memory-target-match.provider.js';
import {
  MatchClassification,
  ExecutionIntentAction
} from '../../../core/types/duplicate.types.js';
import {
  DuplicateStrategy,
  ImportMode,
  RecordStatus
} from '../../../core/types/import.types.js';

describe('DuplicateDetectionEngine', () => {
  const orgId = 'org-tenant-123';

  it('should detect intra-file duplicate groups and preserve all affected row indices', async () => {
    const provider = new InMemoryTargetMatchProvider('contacts');

    const records = [
      new DataImportRecordEntity({
        id: 'rec-1',
        organizationId: orgId,
        importId: 'imp-1',
        rowIndex: 1,
        rawData: { email: 'alice@example.com', first_name: 'Alice', last_name: 'Smith' },
        transformedData: { email: 'alice@example.com', first_name: 'Alice', last_name: 'Smith' },
        status: RecordStatus.VALID
      }),
      new DataImportRecordEntity({
        id: 'rec-2',
        organizationId: orgId,
        importId: 'imp-1',
        rowIndex: 2,
        rawData: { email: 'bob@example.com', first_name: 'Bob', last_name: 'Jones' },
        transformedData: { email: 'bob@example.com', first_name: 'Bob', last_name: 'Jones' },
        status: RecordStatus.VALID
      }),
      new DataImportRecordEntity({
        id: 'rec-3',
        organizationId: orgId,
        importId: 'imp-1',
        rowIndex: 3,
        rawData: { email: 'ALICE@EXAMPLE.COM', first_name: 'Alice', last_name: 'Duplicate' },
        transformedData: { email: 'alice@example.com', first_name: 'Alice', last_name: 'Duplicate' },
        status: RecordStatus.VALID
      })
    ];

    const result = await DuplicateDetectionEngine.evaluateDataset(records, {
      organizationId: orgId,
      entityName: 'contacts',
      duplicateStrategy: DuplicateStrategy.SKIP,
      importMode: ImportMode.UPSERT,
      targetProvider: provider
    });

    assert.equal(result.summary.totalRecords, 3);
    assert.equal(result.summary.newRecords, 2); // rec-1 (first alice) + rec-2 (bob)
    assert.equal(result.summary.duplicateInFile, 1); // rec-3

    const rec1Match = result.matchResults.get('rec-1');
    const rec3Match = result.matchResults.get('rec-3');

    assert.equal(rec1Match?.classification, MatchClassification.NEW);
    assert.equal(rec3Match?.classification, MatchClassification.DUPLICATE_IN_FILE);

    assert.equal(result.summary.duplicateGroups.length, 1);
    assert.equal(result.summary.duplicateRecords, 2);
    const group = result.summary.duplicateGroups[0];
    assert.deepEqual(group.sourceRowNumbers, [1, 3]);
    assert.deepEqual(group.recordIds, ['rec-1', 'rec-3']);
  });

  it('should match existing target records and apply configured DuplicateStrategy', async () => {
    const provider = new InMemoryTargetMatchProvider('contacts');
    provider.seedRecords(orgId, [
      { id: 'target-contact-999', email: 'existing@example.com', first_name: 'Existing', last_name: 'User' }
    ]);

    const record = new DataImportRecordEntity({
      id: 'rec-existing',
      organizationId: orgId,
      importId: 'imp-1',
      rowIndex: 1,
      rawData: { email: 'EXISTING@example.com', first_name: 'Existing', last_name: 'User' },
      transformedData: { email: 'existing@example.com', first_name: 'Existing', last_name: 'User' },
      status: RecordStatus.VALID
    });

    // Test with UPDATE strategy
    const updateResult = await DuplicateDetectionEngine.evaluateDataset([record], {
      organizationId: orgId,
      entityName: 'contacts',
      duplicateStrategy: DuplicateStrategy.UPDATE,
      importMode: ImportMode.UPSERT,
      targetProvider: provider
    });

    assert.equal(updateResult.summary.existingRecords, 1);
    assert.equal(updateResult.summary.duplicateGroups.length, 0);
    assert.equal(updateResult.summary.duplicateRecords, 0);
    const updateIntent = updateResult.intents.get('rec-existing');
    assert.equal(updateIntent?.action, ExecutionIntentAction.UPDATE);
    assert.equal(updateIntent?.targetId, 'target-contact-999');
    assert.equal(updateIntent?.blocked, false);

    // Test with SKIP strategy
    const skipResult = await DuplicateDetectionEngine.evaluateDataset([record], {
      organizationId: orgId,
      entityName: 'contacts',
      duplicateStrategy: DuplicateStrategy.SKIP,
      importMode: ImportMode.UPSERT,
      targetProvider: provider
    });

    const skipIntent = skipResult.intents.get('rec-existing');
    assert.equal(skipIntent?.action, ExecutionIntentAction.SKIP);
    assert.equal(skipIntent?.targetId, 'target-contact-999');

    // Test with SEND_FOR_REVIEW strategy
    const reviewResult = await DuplicateDetectionEngine.evaluateDataset([record], {
      organizationId: orgId,
      entityName: 'contacts',
      duplicateStrategy: DuplicateStrategy.SEND_FOR_REVIEW,
      importMode: ImportMode.UPSERT,
      targetProvider: provider
    });

    const reviewIntent = reviewResult.intents.get('rec-existing');
    assert.equal(reviewIntent?.action, ExecutionIntentAction.UPDATE);
    assert.equal(reviewIntent?.blocked, false);
  });

  it('should flag MULTIPLE_MATCH and send for review when target has ambiguous duplicates', async () => {
    const provider = new InMemoryTargetMatchProvider('contacts');
    provider.seedRecords(orgId, [
      { id: 'target-1', email: 'multi@example.com', first_name: 'Multi', last_name: 'One' },
      { id: 'target-2', email: 'multi@example.com', first_name: 'Multi', last_name: 'Two' }
    ]);

    const record = new DataImportRecordEntity({
      id: 'rec-multi',
      organizationId: orgId,
      importId: 'imp-1',
      rowIndex: 1,
      rawData: { email: 'multi@example.com', first_name: 'Multi', last_name: 'User' },
      transformedData: { email: 'multi@example.com', first_name: 'Multi', last_name: 'User' },
      status: RecordStatus.VALID
    });

    const result = await DuplicateDetectionEngine.evaluateDataset([record], {
      organizationId: orgId,
      entityName: 'contacts',
      duplicateStrategy: DuplicateStrategy.UPDATE,
      importMode: ImportMode.UPSERT,
      targetProvider: provider
    });

    assert.equal(result.summary.multipleMatches, 1);
    assert.equal(result.summary.conflicts, 1);
    assert.equal(result.summary.duplicateGroups.length, 0);

    const matchRes = result.matchResults.get('rec-multi');
    assert.equal(matchRes?.classification, MatchClassification.MULTIPLE_MATCH);
    assert.deepEqual(matchRes?.candidateTargetIds?.sort(), ['target-1', 'target-2']);

    const intent = result.intents.get('rec-multi');
    assert.equal(intent?.action, ExecutionIntentAction.REVIEW);
    assert.equal(intent?.blocked, true);
  });

  it('should handle INVALID records and records with missing match keys', async () => {
    const provider = new InMemoryTargetMatchProvider('contacts');

    const invalidRec = new DataImportRecordEntity({
      id: 'rec-invalid',
      organizationId: orgId,
      importId: 'imp-1',
      rowIndex: 1,
      rawData: { email: 'bad' },
      status: RecordStatus.INVALID,
      validationErrors: [{ field: 'email', code: 'INVALID_EMAIL', message: 'Invalid', severity: 'ERROR' }]
    });

    const missingKeyRec = new DataImportRecordEntity({
      id: 'rec-missing-key',
      organizationId: orgId,
      importId: 'imp-1',
      rowIndex: 2,
      rawData: { first_name: 'NoEmail' },
      transformedData: { first_name: 'NoEmail' },
      status: RecordStatus.VALID
    });

    const result = await DuplicateDetectionEngine.evaluateDataset([invalidRec, missingKeyRec], {
      organizationId: orgId,
      entityName: 'contacts',
      duplicateStrategy: DuplicateStrategy.SKIP,
      targetProvider: provider
    });

    assert.equal(result.summary.invalidRecords, 1);
    assert.equal(result.summary.unresolved, 1);
    assert.equal(result.summary.blocked, 2);

    assert.equal(result.matchResults.get('rec-invalid')?.classification, MatchClassification.INVALID);
    assert.equal(result.matchResults.get('rec-missing-key')?.classification, MatchClassification.UNRESOLVED);
  });

  it('should allow warning-only records through duplicate matching', async () => {
    const provider = new InMemoryTargetMatchProvider('contacts');
    const warningRec = new DataImportRecordEntity({
      id: 'rec-warning-only',
      organizationId: orgId,
      importId: 'imp-1',
      rowIndex: 3,
      rawData: { email: 'warning@example.com', first_name: 'Warning', last_name: 'User' },
      transformedData: { email: 'warning@example.com', first_name: 'Warning', last_name: 'User' },
      status: RecordStatus.VALID,
      validationErrors: [{
        field: 'first_name',
        code: 'VALUE_NORMALIZED',
        message: 'Value was normalized',
        severity: 'WARNING'
      }]
    });

    const result = await DuplicateDetectionEngine.evaluateDataset([warningRec], {
      organizationId: orgId,
      entityName: 'contacts',
      duplicateStrategy: DuplicateStrategy.SEND_FOR_REVIEW,
      importMode: ImportMode.UPSERT,
      targetProvider: provider
    });

    assert.equal(result.summary.invalidRecords, 0);
    assert.equal(result.matchResults.get('rec-warning-only')?.classification, MatchClassification.NEW);
    assert.equal(result.intents.get('rec-warning-only')?.action, ExecutionIntentAction.CREATE);
    assert.equal(result.intents.get('rec-warning-only')?.blocked, false);
  });
});
