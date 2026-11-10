/**
 * Strict Import Lifecycle State Machine
 */

import { ImportStatus } from '../../core/types/import.types.js';
import { InvalidStateTransitionError } from '../../core/errors/import.errors.js';
import { DataImportEntity } from '../entities/data-import.entity.js';

export class ImportStateMachine {
  /**
   * Explicit valid state transition map derived from Phase 1 Architecture.
   */
  private static readonly VALID_TRANSITIONS: Record<ImportStatus, ImportStatus[]> = {
    [ImportStatus.DRAFT]: [
      ImportStatus.UPLOADED,
      ImportStatus.MAPPING,
      ImportStatus.FAILED,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.UPLOADED]: [
      ImportStatus.DRAFT,
      ImportStatus.PARSING,
      ImportStatus.MAPPING,
      ImportStatus.FAILED,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.PARSING]: [
      ImportStatus.PARSED,
      ImportStatus.FAILED,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.PARSED]: [
      ImportStatus.DRAFT,
      ImportStatus.MAPPING,
      ImportStatus.VALIDATING,
      ImportStatus.FAILED,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.MAPPING]: [
      ImportStatus.DRAFT,
      ImportStatus.MAPPED,
      ImportStatus.PARSED,
      ImportStatus.FAILED,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.MAPPED]: [
      ImportStatus.DRAFT,
      ImportStatus.VALIDATING,
      ImportStatus.MAPPING,
      ImportStatus.FAILED,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.VALIDATING]: [
      ImportStatus.DRAFT,
      ImportStatus.VALIDATED,
      ImportStatus.VALIDATION_FAILED,
      ImportStatus.FAILED,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.VALIDATION_FAILED]: [
      ImportStatus.DRAFT,
      // User can go back to mapping to correct field mappings/transformations
      ImportStatus.MAPPING,
      // User can go back to upload to replace source file (wipes mapping/records)
      ImportStatus.UPLOADED,
      // User can re-run validation after fixing mapping (e.g. via API re-trigger)
      ImportStatus.VALIDATING,
      // Record correction resolves all invalid rows -> VALIDATED
      ImportStatus.VALIDATED,
      ImportStatus.FAILED,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.VALIDATED]: [
      ImportStatus.DRAFT,
      // Revalidation is allowed after changing the source data or mapping.
      ImportStatus.VALIDATING,
      // Duplicate scan is a read/analysis operation — transitions to MATCHING transiently
      ImportStatus.MATCHING,
      // Direct transition if approval is required (bypassing explicit duplicate scan UI)
      ImportStatus.REQUIRES_APPROVAL,
      ImportStatus.PENDING_APPROVAL,
      ImportStatus.APPROVED,
      ImportStatus.REJECTED,
      ImportStatus.QUEUED,
      // Back to mapping for reconfiguration (invalidates approval if any)
      ImportStatus.MAPPING,
      ImportStatus.FAILED,
      ImportStatus.CANCELLED
    ],
    // MATCHING: transient state during duplicate detection scan.
    // Returns to VALIDATED when scan completes (records are updated but import config unchanged).
    [ImportStatus.MATCHING]: [
      ImportStatus.DRAFT,
      ImportStatus.VALIDATED,  // scan completed successfully
      ImportStatus.FAILED,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.REQUIRES_APPROVAL]: [
      ImportStatus.DRAFT,
      ImportStatus.PENDING_APPROVAL,
      ImportStatus.MAPPING,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.PENDING_APPROVAL]: [
      ImportStatus.DRAFT,
      ImportStatus.APPROVED,
      ImportStatus.REJECTED,
      ImportStatus.MAPPING,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.APPROVED]: [
      ImportStatus.DRAFT,
      ImportStatus.QUEUED,
      ImportStatus.PENDING_APPROVAL, // When invalidated by edits
      ImportStatus.MAPPING,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.REJECTED]: [
      ImportStatus.DRAFT,
      ImportStatus.MAPPING,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.QUEUED]: [
      ImportStatus.PROCESSING,
      ImportStatus.FAILED,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.PROCESSING]: [
      ImportStatus.COMPLETED,
      ImportStatus.COMPLETED_WITH_ERRORS,
      ImportStatus.FAILED,
      ImportStatus.RECONCILIATION_REQUIRED,
      ImportStatus.CANCELLED
    ],
    [ImportStatus.COMPLETED]: [], // Terminal state
    [ImportStatus.COMPLETED_WITH_ERRORS]: [
      ImportStatus.QUEUED // Allowed for retry of failed subset
    ],
    [ImportStatus.FAILED]: [
      ImportStatus.QUEUED, // Allowed for overall retry
      ImportStatus.DRAFT
    ],
    [ImportStatus.CANCELLED]: [], // Terminal state
    [ImportStatus.RECONCILIATION_REQUIRED]: [
      ImportStatus.COMPLETED,
      ImportStatus.FAILED
    ]
  };


  /**
   * Checks if a status is terminal (COMPLETED, CANCELLED).
   */
  public static isTerminal(status: ImportStatus): boolean {
    return status === ImportStatus.COMPLETED || status === ImportStatus.CANCELLED;
  }

  /**
   * Evaluates if a transition from currentState to targetState is permitted.
   */
  public static canTransition(currentState: ImportStatus, targetState: ImportStatus): boolean {
    if (this.isTerminal(currentState)) {
      return false; // No transitions out of terminal states
    }
    if (currentState === targetState) {
      return true; // Idempotent no-op for non-terminal states
    }
    const allowed = this.VALID_TRANSITIONS[currentState] || [];
    return allowed.includes(targetState);
  }

  /**
   * Returns all valid next states for a given state.
   */
  public static getAllowedTransitions(currentState: ImportStatus): ImportStatus[] {
    return this.VALID_TRANSITIONS[currentState] || [];
  }

  /**
   * Applies the state transition on a DataImportEntity after validating rules.
   * Throws InvalidStateTransitionError if transition is illegal.
   */
  public static transition(importEntity: DataImportEntity, nextState: ImportStatus): void {
    if (!this.canTransition(importEntity.status, nextState)) {
      throw new InvalidStateTransitionError(importEntity.status, nextState);
    }

    if (importEntity.status === nextState) {
      return; // No-op
    }

    const previousState = importEntity.status;
    importEntity.status = nextState;
    importEntity.updatedAt = new Date();
    importEntity.version += 1;

    // Handle lifecycle timestamps
    if (nextState === ImportStatus.PROCESSING && !importEntity.startedAt) {
      importEntity.startedAt = new Date();
    } else if (
      [ImportStatus.COMPLETED, ImportStatus.COMPLETED_WITH_ERRORS, ImportStatus.FAILED].includes(
        nextState
      )
    ) {
      importEntity.completedAt = new Date();
    } else if (nextState === ImportStatus.CANCELLED) {
      importEntity.cancelledAt = new Date();
    }
  }

  /**
   * Checks if an import is cancellable in its current state.
   */
  public static isCancellable(status: ImportStatus): boolean {
    if (this.isTerminal(status)) {
      return false;
    }
    const allowed = this.VALID_TRANSITIONS[status] || [];
    return allowed.includes(ImportStatus.CANCELLED);
  }
}
