/**
 * Structured Error Hierarchy for Data Import Centre
 */
import { ApiErrorDetail } from '../types/import.types.js';
export declare abstract class BaseImportError extends Error {
    abstract readonly statusCode: number;
    abstract readonly errorCode: string;
    readonly details: ApiErrorDetail[];
    constructor(message: string, details?: ApiErrorDetail[]);
    toJSON(): {
        code: string;
        message: string;
        details: ApiErrorDetail[] | undefined;
    };
}
export declare class ValidationError extends BaseImportError {
    readonly statusCode = 400;
    readonly errorCode = "VALIDATION_ERROR";
    constructor(message?: string, details?: ApiErrorDetail[]);
}
export declare class UnauthorizedError extends BaseImportError {
    readonly statusCode = 401;
    readonly errorCode = "UNAUTHORIZED";
    constructor(message?: string, details?: ApiErrorDetail[]);
}
export declare class ForbiddenError extends BaseImportError {
    readonly statusCode = 403;
    readonly errorCode = "FORBIDDEN";
    constructor(message?: string, details?: ApiErrorDetail[]);
}
export declare class NotFoundError extends BaseImportError {
    readonly statusCode = 404;
    readonly errorCode = "NOT_FOUND";
    constructor(message?: string, details?: ApiErrorDetail[]);
}
export declare class ConflictError extends BaseImportError {
    readonly statusCode = 409;
    readonly errorCode = "CONFLICT";
    constructor(message?: string, details?: ApiErrorDetail[]);
}
export declare class InvalidStateTransitionError extends BaseImportError {
    readonly statusCode = 422;
    readonly errorCode = "INVALID_STATE_TRANSITION";
    constructor(currentState: string, targetState: string, message?: string);
}
export declare class ImportConfigurationError extends BaseImportError {
    readonly statusCode = 400;
    readonly errorCode = "IMPORT_CONFIGURATION_ERROR";
    constructor(message: string, details?: ApiErrorDetail[]);
}
export declare class ImportProcessingError extends BaseImportError {
    readonly statusCode = 500;
    readonly errorCode = "IMPORT_PROCESSING_ERROR";
    constructor(message: string, details?: ApiErrorDetail[]);
}
export declare class SecurityViolationError extends BaseImportError {
    readonly statusCode = 403;
    readonly errorCode = "SECURITY_VIOLATION";
    constructor(message: string, details?: ApiErrorDetail[]);
}
//# sourceMappingURL=import.errors.d.ts.map