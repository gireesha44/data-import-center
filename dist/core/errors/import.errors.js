/**
 * Structured Error Hierarchy for Data Import Centre
 */
export class BaseImportError extends Error {
    details;
    constructor(message, details = []) {
        super(message);
        this.name = this.constructor.name;
        this.details = details;
        Object.setPrototypeOf(this, new.target.prototype);
    }
    toJSON() {
        return {
            code: this.errorCode,
            message: this.message,
            details: this.details.length > 0 ? this.details : undefined
        };
    }
}
export class ValidationError extends BaseImportError {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    constructor(message = 'Validation failed', details = []) {
        super(message, details);
    }
}
export class UnauthorizedError extends BaseImportError {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    constructor(message = 'Authentication required', details = []) {
        super(message, details);
    }
}
export class ForbiddenError extends BaseImportError {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
    constructor(message = 'Permission denied for this operation', details = []) {
        super(message, details);
    }
}
export class NotFoundError extends BaseImportError {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    constructor(message = 'Requested resource was not found', details = []) {
        super(message, details);
    }
}
export class ConflictError extends BaseImportError {
    statusCode = 409;
    errorCode = 'CONFLICT';
    constructor(message = 'Resource conflict detected', details = []) {
        super(message, details);
    }
}
export class InvalidStateTransitionError extends BaseImportError {
    statusCode = 422;
    errorCode = 'INVALID_STATE_TRANSITION';
    constructor(currentState, targetState, message) {
        super(message || `Cannot transition import state from '${currentState}' to '${targetState}'`, [
            {
                code: 'STATE_TRANSITION_DISALLOWED',
                message: `Transition from ${currentState} to ${targetState} is not allowed by state machine rules.`,
                context: { currentState, targetState }
            }
        ]);
    }
}
export class ImportConfigurationError extends BaseImportError {
    statusCode = 400;
    errorCode = 'IMPORT_CONFIGURATION_ERROR';
    constructor(message, details = []) {
        super(message, details);
    }
}
export class ImportProcessingError extends BaseImportError {
    statusCode = 500;
    errorCode = 'IMPORT_PROCESSING_ERROR';
    constructor(message, details = []) {
        super(message, details);
    }
}
export class SecurityViolationError extends BaseImportError {
    statusCode = 403;
    errorCode = 'SECURITY_VIOLATION';
    constructor(message, details = []) {
        super(message, details);
    }
}
//# sourceMappingURL=import.errors.js.map