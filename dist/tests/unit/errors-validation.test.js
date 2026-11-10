/**
 * Unit Tests: Error Hierarchy & Validation Schemas
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, InvalidStateTransitionError, ImportConfigurationError, ImportProcessingError, SecurityViolationError } from '../../core/errors/import.errors.js';
import { createImportRequestSchema, listImportsQuerySchema } from '../../api/validation/import.validation.js';
import { DuplicateStrategy, ErrorStrategy, ImportSourceType } from '../../core/types/import.types.js';
describe('Error Hierarchy & Validation Schemas', () => {
    it('should instantiate error classes with correct HTTP status and error codes', () => {
        const valErr = new ValidationError('Bad input', [{ code: 'REQ', message: 'Required' }]);
        assert.equal(valErr.statusCode, 400);
        assert.equal(valErr.errorCode, 'VALIDATION_ERROR');
        assert.equal(valErr.details.length, 1);
        const unauthErr = new UnauthorizedError();
        assert.equal(unauthErr.statusCode, 401);
        assert.equal(unauthErr.errorCode, 'UNAUTHORIZED');
        const forbErr = new ForbiddenError();
        assert.equal(forbErr.statusCode, 403);
        assert.equal(forbErr.errorCode, 'FORBIDDEN');
        const notFoundErr = new NotFoundError();
        assert.equal(notFoundErr.statusCode, 404);
        assert.equal(notFoundErr.errorCode, 'NOT_FOUND');
        const conflictErr = new ConflictError();
        assert.equal(conflictErr.statusCode, 409);
        assert.equal(conflictErr.errorCode, 'CONFLICT');
        const stateErr = new InvalidStateTransitionError('DRAFT', 'COMPLETED');
        assert.equal(stateErr.statusCode, 422);
        assert.equal(stateErr.errorCode, 'INVALID_STATE_TRANSITION');
        const configErr = new ImportConfigurationError('Config error');
        assert.equal(configErr.statusCode, 400);
        assert.equal(configErr.errorCode, 'IMPORT_CONFIGURATION_ERROR');
        const procErr = new ImportProcessingError('Internal failure');
        assert.equal(procErr.statusCode, 500);
        assert.equal(procErr.errorCode, 'IMPORT_PROCESSING_ERROR');
        const secErr = new SecurityViolationError('Forbidden access');
        assert.equal(secErr.statusCode, 403);
        assert.equal(secErr.errorCode, 'SECURITY_VIOLATION');
    });
    it('should validate valid CreateImport payload using Zod schema', () => {
        const payload = {
            name: 'Q3 Invoices Import',
            targetModule: 'finance',
            targetEntity: 'invoices',
            sourceType: ImportSourceType.FILE_UPLOAD,
            importOptions: {
                duplicateStrategy: DuplicateStrategy.UPDATE,
                errorStrategy: ErrorStrategy.CONTINUE_ON_ERROR,
                batchSize: 250
            }
        };
        const parsed = createImportRequestSchema.parse(payload);
        assert.equal(parsed.name, 'Q3 Invoices Import');
        assert.equal(parsed.targetEntity, 'invoices');
        assert.equal(parsed.importOptions?.batchSize, 250);
    });
    it('should reject invalid CreateImport payload (missing name, invalid batch size)', () => {
        assert.throws(() => createImportRequestSchema.parse({
            name: '',
            targetEntity: 'contacts'
        }), /Name is required/);
        assert.throws(() => createImportRequestSchema.parse({
            name: 'Valid Name',
            targetEntity: 'contacts',
            importOptions: {
                batchSize: 5000 // Exceeds max 2000
            }
        }), /Number must be less than or equal to 2000/);
    });
    it('should parse and coerce list query parameters with defaults', () => {
        const parsed = listImportsQuerySchema.parse({
            page: '2',
            limit: '50',
            sortOrder: 'ASC'
        });
        assert.equal(parsed.page, 2);
        assert.equal(parsed.limit, 50);
        assert.equal(parsed.sortOrder, 'ASC');
        assert.equal(parsed.sortBy, 'createdAt');
    });
});
//# sourceMappingURL=errors-validation.test.js.map