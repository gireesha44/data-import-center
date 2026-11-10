/**
 * Unit Tests: Import State Machine
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ImportStateMachine } from '../../domain/state-machine/import-state-machine.js';
import { ImportStatus } from '../../core/types/import.types.js';
import { DataImportEntity } from '../../domain/entities/data-import.entity.js';
import { InvalidStateTransitionError } from '../../core/errors/import.errors.js';
describe('ImportStateMachine', () => {
    const createMockImport = (status = ImportStatus.DRAFT) => {
        return new DataImportEntity({
            id: 'import_123',
            organizationId: 'org_abc',
            targetModule: 'crm',
            targetEntity: 'contacts',
            name: 'Test Import',
            status,
            createdBy: 'user_1'
        });
    };
    it('should allow valid sequential progression: DRAFT -> UPLOADED -> PARSING -> PARSED -> MAPPING -> MAPPED -> VALIDATING -> VALIDATED', () => {
        const item = createMockImport(ImportStatus.DRAFT);
        ImportStateMachine.transition(item, ImportStatus.UPLOADED);
        assert.equal(item.status, ImportStatus.UPLOADED);
        ImportStateMachine.transition(item, ImportStatus.PARSING);
        assert.equal(item.status, ImportStatus.PARSING);
        ImportStateMachine.transition(item, ImportStatus.PARSED);
        assert.equal(item.status, ImportStatus.PARSED);
        ImportStateMachine.transition(item, ImportStatus.MAPPING);
        assert.equal(item.status, ImportStatus.MAPPING);
        ImportStateMachine.transition(item, ImportStatus.MAPPED);
        assert.equal(item.status, ImportStatus.MAPPED);
        ImportStateMachine.transition(item, ImportStatus.VALIDATING);
        assert.equal(item.status, ImportStatus.VALIDATING);
        ImportStateMachine.transition(item, ImportStatus.VALIDATED);
        assert.equal(item.status, ImportStatus.VALIDATED);
    });
    it('should reject invalid direct transitions (e.g. DRAFT -> COMPLETED, DRAFT -> PROCESSING)', () => {
        const item = createMockImport(ImportStatus.DRAFT);
        assert.throws(() => ImportStateMachine.transition(item, ImportStatus.COMPLETED), InvalidStateTransitionError);
        assert.throws(() => ImportStateMachine.transition(item, ImportStatus.PROCESSING), InvalidStateTransitionError);
        assert.throws(() => ImportStateMachine.transition(item, ImportStatus.APPROVED), InvalidStateTransitionError);
    });
    it('should allow cancellation from cancellable states (DRAFT, UPLOADED, PARSED, VALIDATED, QUEUED)', () => {
        const cancellableStates = [
            ImportStatus.DRAFT,
            ImportStatus.UPLOADED,
            ImportStatus.PARSED,
            ImportStatus.MAPPING,
            ImportStatus.VALIDATED,
            ImportStatus.PENDING_APPROVAL,
            ImportStatus.QUEUED,
            ImportStatus.PROCESSING
        ];
        for (const st of cancellableStates) {
            const item = createMockImport(st);
            assert.equal(ImportStateMachine.isCancellable(st), true);
            ImportStateMachine.transition(item, ImportStatus.CANCELLED);
            assert.equal(item.status, ImportStatus.CANCELLED);
            assert.ok(item.cancelledAt !== null);
        }
    });
    it('should reject cancellation from terminal states (COMPLETED, CANCELLED)', () => {
        const completedItem = createMockImport(ImportStatus.COMPLETED);
        assert.equal(ImportStateMachine.isCancellable(ImportStatus.COMPLETED), false);
        assert.throws(() => ImportStateMachine.transition(completedItem, ImportStatus.CANCELLED), InvalidStateTransitionError);
        const cancelledItem = createMockImport(ImportStatus.CANCELLED);
        assert.equal(ImportStateMachine.isCancellable(ImportStatus.CANCELLED), false);
    });
    it('should set startedAt on transition to PROCESSING and completedAt on COMPLETED', () => {
        const item = createMockImport(ImportStatus.QUEUED);
        assert.equal(item.startedAt, null);
        ImportStateMachine.transition(item, ImportStatus.PROCESSING);
        assert.ok(item.startedAt !== null);
        ImportStateMachine.transition(item, ImportStatus.COMPLETED);
        assert.ok(item.completedAt !== null);
    });
    it('should return allowed transitions correctly', () => {
        const draftTransitions = ImportStateMachine.getAllowedTransitions(ImportStatus.DRAFT);
        assert.ok(draftTransitions.includes(ImportStatus.UPLOADED));
        assert.ok(draftTransitions.includes(ImportStatus.CANCELLED));
        assert.ok(!draftTransitions.includes(ImportStatus.COMPLETED));
        const completedTransitions = ImportStateMachine.getAllowedTransitions(ImportStatus.COMPLETED);
        assert.equal(completedTransitions.length, 0);
    });
    it('should handle idempotent self-transition safely', () => {
        const item = createMockImport(ImportStatus.DRAFT);
        const initialVersion = item.version;
        ImportStateMachine.transition(item, ImportStatus.DRAFT);
        assert.equal(item.status, ImportStatus.DRAFT);
        assert.equal(item.version, initialVersion);
    });
});
//# sourceMappingURL=state-machine.test.js.map