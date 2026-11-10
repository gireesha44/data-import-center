import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ImportStateMachine } from '../../../domain/state-machine/import-state-machine.js';
import { ImportStatus } from '../../../core/types/import.types.js';
import { InvalidStateTransitionError } from '../../../core/errors/import.errors.js';
import { DataImportEntity } from '../../../domain/entities/data-import.entity.js';

describe('ImportStateMachine - Exhaustive Transition Matrix', () => {
  const allStatuses: ImportStatus[] = [
    ImportStatus.DRAFT,
    ImportStatus.UPLOADED,
    ImportStatus.PARSING,
    ImportStatus.PARSED,
    ImportStatus.MAPPING,
    ImportStatus.MAPPED,
    ImportStatus.VALIDATING,
    ImportStatus.VALIDATED,
    ImportStatus.VALIDATION_FAILED,
    ImportStatus.MATCHING,
    ImportStatus.REQUIRES_APPROVAL,
    ImportStatus.PENDING_APPROVAL,
    ImportStatus.APPROVED,
    ImportStatus.REJECTED,
    ImportStatus.QUEUED,
    ImportStatus.PROCESSING,
    ImportStatus.COMPLETED,
    ImportStatus.COMPLETED_WITH_ERRORS,
    ImportStatus.FAILED,
    ImportStatus.CANCELLED,
    ImportStatus.RECONCILIATION_REQUIRED,
  ];

  function createEntity(initialStatus: ImportStatus): DataImportEntity {
    return {
      id: 'imp-test',
      organizationId: 'org-test',
      entityType: 'contacts',
      status: initialStatus,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as DataImportEntity;
  }

  it('verifies all legitimate transitions defined in transition matrix', () => {
    const validTransitions: Array<[ImportStatus, ImportStatus]> = [
      [ImportStatus.DRAFT, ImportStatus.UPLOADED],
      [ImportStatus.DRAFT, ImportStatus.FAILED],
      [ImportStatus.DRAFT, ImportStatus.CANCELLED],

      [ImportStatus.UPLOADED, ImportStatus.PARSING],
      [ImportStatus.UPLOADED, ImportStatus.DRAFT],
      [ImportStatus.UPLOADED, ImportStatus.FAILED],
      [ImportStatus.UPLOADED, ImportStatus.CANCELLED],

      [ImportStatus.PARSING, ImportStatus.PARSED],
      [ImportStatus.PARSING, ImportStatus.FAILED],
      [ImportStatus.PARSING, ImportStatus.CANCELLED],

      [ImportStatus.PARSED, ImportStatus.MAPPING],
      [ImportStatus.PARSED, ImportStatus.VALIDATING],
      [ImportStatus.PARSED, ImportStatus.FAILED],
      [ImportStatus.PARSED, ImportStatus.CANCELLED],

      [ImportStatus.MAPPING, ImportStatus.MAPPED],
      [ImportStatus.MAPPING, ImportStatus.PARSED],
      [ImportStatus.MAPPING, ImportStatus.FAILED],
      [ImportStatus.MAPPING, ImportStatus.CANCELLED],

      [ImportStatus.MAPPED, ImportStatus.VALIDATING],
      [ImportStatus.MAPPED, ImportStatus.MAPPING],
      [ImportStatus.MAPPED, ImportStatus.FAILED],
      [ImportStatus.MAPPED, ImportStatus.CANCELLED],

      [ImportStatus.VALIDATING, ImportStatus.DRAFT],
      [ImportStatus.VALIDATING, ImportStatus.VALIDATED],
      [ImportStatus.VALIDATING, ImportStatus.VALIDATION_FAILED],
      [ImportStatus.VALIDATING, ImportStatus.FAILED],
      [ImportStatus.VALIDATING, ImportStatus.CANCELLED],

      [ImportStatus.VALIDATION_FAILED, ImportStatus.DRAFT],
      [ImportStatus.VALIDATION_FAILED, ImportStatus.MAPPING],
      [ImportStatus.VALIDATION_FAILED, ImportStatus.UPLOADED],
      [ImportStatus.VALIDATION_FAILED, ImportStatus.VALIDATING],
      [ImportStatus.VALIDATION_FAILED, ImportStatus.FAILED],
      [ImportStatus.VALIDATION_FAILED, ImportStatus.CANCELLED],

      [ImportStatus.VALIDATED, ImportStatus.DRAFT],
      [ImportStatus.VALIDATED, ImportStatus.VALIDATING],
      [ImportStatus.VALIDATED, ImportStatus.MATCHING],
      [ImportStatus.VALIDATED, ImportStatus.REQUIRES_APPROVAL],
      [ImportStatus.VALIDATED, ImportStatus.PENDING_APPROVAL],
      [ImportStatus.VALIDATED, ImportStatus.APPROVED],
      [ImportStatus.VALIDATED, ImportStatus.REJECTED],
      [ImportStatus.VALIDATED, ImportStatus.QUEUED],
      [ImportStatus.VALIDATED, ImportStatus.MAPPING],
      [ImportStatus.VALIDATED, ImportStatus.FAILED],
      [ImportStatus.VALIDATED, ImportStatus.CANCELLED],

      [ImportStatus.MATCHING, ImportStatus.DRAFT],
      [ImportStatus.MATCHING, ImportStatus.VALIDATED],
      [ImportStatus.MATCHING, ImportStatus.FAILED],
      [ImportStatus.MATCHING, ImportStatus.CANCELLED],

      [ImportStatus.REQUIRES_APPROVAL, ImportStatus.DRAFT],
      [ImportStatus.REQUIRES_APPROVAL, ImportStatus.PENDING_APPROVAL],
      [ImportStatus.REQUIRES_APPROVAL, ImportStatus.MAPPING],
      [ImportStatus.REQUIRES_APPROVAL, ImportStatus.CANCELLED],

      [ImportStatus.PENDING_APPROVAL, ImportStatus.DRAFT],
      [ImportStatus.PENDING_APPROVAL, ImportStatus.APPROVED],
      [ImportStatus.PENDING_APPROVAL, ImportStatus.REJECTED],
      [ImportStatus.PENDING_APPROVAL, ImportStatus.MAPPING],
      [ImportStatus.PENDING_APPROVAL, ImportStatus.CANCELLED],

      [ImportStatus.APPROVED, ImportStatus.DRAFT],
      [ImportStatus.APPROVED, ImportStatus.QUEUED],
      [ImportStatus.APPROVED, ImportStatus.PENDING_APPROVAL],
      [ImportStatus.APPROVED, ImportStatus.MAPPING],
      [ImportStatus.APPROVED, ImportStatus.CANCELLED],

      [ImportStatus.REJECTED, ImportStatus.MAPPING],
      [ImportStatus.REJECTED, ImportStatus.DRAFT],
      [ImportStatus.REJECTED, ImportStatus.CANCELLED],

      [ImportStatus.QUEUED, ImportStatus.PROCESSING],
      [ImportStatus.QUEUED, ImportStatus.FAILED],
      [ImportStatus.QUEUED, ImportStatus.CANCELLED],

      [ImportStatus.PROCESSING, ImportStatus.COMPLETED],
      [ImportStatus.PROCESSING, ImportStatus.COMPLETED_WITH_ERRORS],
      [ImportStatus.PROCESSING, ImportStatus.FAILED],
      [ImportStatus.PROCESSING, ImportStatus.RECONCILIATION_REQUIRED],
      [ImportStatus.PROCESSING, ImportStatus.CANCELLED],

      [ImportStatus.COMPLETED_WITH_ERRORS, ImportStatus.QUEUED],

      [ImportStatus.FAILED, ImportStatus.QUEUED],
      [ImportStatus.FAILED, ImportStatus.DRAFT],

      [ImportStatus.RECONCILIATION_REQUIRED, ImportStatus.COMPLETED],
      [ImportStatus.RECONCILIATION_REQUIRED, ImportStatus.FAILED],
    ];

    for (const [from, to] of validTransitions) {
      assert.strictEqual(
        ImportStateMachine.canTransition(from, to),
        true,
        `Expected transition from ${from} to ${to} to be VALID`
      );

      const entity = createEntity(from);
      assert.doesNotThrow(() => ImportStateMachine.transition(entity, to));
      assert.strictEqual(entity.status, to);
    }
  });

  it('rejects illegal jump transitions across state pairs', () => {
    const invalidPairs: Array<[ImportStatus, ImportStatus]> = [
      [ImportStatus.DRAFT, ImportStatus.COMPLETED],
      [ImportStatus.DRAFT, ImportStatus.APPROVED],
      [ImportStatus.DRAFT, ImportStatus.PROCESSING],
      [ImportStatus.UPLOADED, ImportStatus.APPROVED],
      [ImportStatus.PARSED, ImportStatus.COMPLETED],
      [ImportStatus.MAPPING, ImportStatus.APPROVED],
      [ImportStatus.VALIDATING, ImportStatus.COMPLETED],
      [ImportStatus.APPROVED, ImportStatus.COMPLETED],
      [ImportStatus.COMPLETED, ImportStatus.PROCESSING],
      [ImportStatus.CANCELLED, ImportStatus.DRAFT],
    ];

    for (const [from, to] of invalidPairs) {
      assert.strictEqual(
        ImportStateMachine.canTransition(from, to),
        false,
        `Transition ${from} -> ${to} should be ILLEGAL`
      );

      const entity = createEntity(from);
      assert.throws(
        () => ImportStateMachine.transition(entity, to),
        InvalidStateTransitionError
      );
    }
  });

  it('verifies terminal states (COMPLETED, CANCELLED) have no allowed transitions', () => {
    const terminalStates = [
      ImportStatus.COMPLETED,
      ImportStatus.CANCELLED,
    ];

    for (const terminal of terminalStates) {
      for (const anyTarget of allStatuses) {
        if (anyTarget === terminal) continue; // skip identical
        assert.strictEqual(ImportStateMachine.canTransition(terminal, anyTarget), false);
        const entity = createEntity(terminal);
        assert.throws(
          () => ImportStateMachine.transition(entity, anyTarget),
          InvalidStateTransitionError
        );
      }
    }
  });
});
