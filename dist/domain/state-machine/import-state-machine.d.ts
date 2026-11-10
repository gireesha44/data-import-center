/**
 * Strict Import Lifecycle State Machine
 */
import { ImportStatus } from '../../core/types/import.types.js';
import { DataImportEntity } from '../entities/data-import.entity.js';
export declare class ImportStateMachine {
    /**
     * Explicit valid state transition map derived from Phase 1 Architecture.
     */
    private static readonly VALID_TRANSITIONS;
    /**
     * Checks if a status is terminal (COMPLETED, CANCELLED).
     */
    static isTerminal(status: ImportStatus): boolean;
    /**
     * Evaluates if a transition from currentState to targetState is permitted.
     */
    static canTransition(currentState: ImportStatus, targetState: ImportStatus): boolean;
    /**
     * Returns all valid next states for a given state.
     */
    static getAllowedTransitions(currentState: ImportStatus): ImportStatus[];
    /**
     * Applies the state transition on a DataImportEntity after validating rules.
     * Throws InvalidStateTransitionError if transition is illegal.
     */
    static transition(importEntity: DataImportEntity, nextState: ImportStatus): void;
    /**
     * Checks if an import is cancellable in its current state.
     */
    static isCancellable(status: ImportStatus): boolean;
}
//# sourceMappingURL=import-state-machine.d.ts.map