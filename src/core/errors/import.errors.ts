/**
 * Structured Error Hierarchy for Data Import Centre
 */

import { ApiErrorDetail } from '../types/import.types.js';

export abstract class BaseImportError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly errorCode: string;
  public readonly details: ApiErrorDetail[];

  constructor(message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON() {
    return {
      code: this.errorCode,
      message: this.message,
      details: this.details.length > 0 ? this.details : undefined
    };
  }
}

export class ValidationError extends BaseImportError {
  public readonly statusCode = 400;
  public readonly errorCode = 'VALIDATION_ERROR';

  constructor(message = 'Validation failed', details: ApiErrorDetail[] = []) {
    super(message, details);
  }
}

export class UnauthorizedError extends BaseImportError {
  public readonly statusCode = 401;
  public readonly errorCode = 'UNAUTHORIZED';

  constructor(message = 'Authentication required', details: ApiErrorDetail[] = []) {
    super(message, details);
  }
}

export class ForbiddenError extends BaseImportError {
  public readonly statusCode = 403;
  public readonly errorCode = 'FORBIDDEN';

  constructor(message = 'Permission denied for this operation', details: ApiErrorDetail[] = []) {
    super(message, details);
  }
}

export class NotFoundError extends BaseImportError {
  public readonly statusCode = 404;
  public readonly errorCode = 'NOT_FOUND';

  constructor(message = 'Requested resource was not found', details: ApiErrorDetail[] = []) {
    super(message, details);
  }
}

export class ConflictError extends BaseImportError {
  public readonly statusCode = 409;
  public readonly errorCode = 'CONFLICT';

  constructor(message = 'Resource conflict detected', details: ApiErrorDetail[] = []) {
    super(message, details);
  }
}

export class InvalidStateTransitionError extends BaseImportError {
  public readonly statusCode = 422;
  public readonly errorCode = 'INVALID_STATE_TRANSITION';

  constructor(
    currentState: string,
    targetState: string,
    message?: string
  ) {
    super(
      message || `Cannot transition import state from '${currentState}' to '${targetState}'`,
      [
        {
          code: 'STATE_TRANSITION_DISALLOWED',
          message: `Transition from ${currentState} to ${targetState} is not allowed by state machine rules.`,
          context: { currentState, targetState }
        }
      ]
    );
  }
}

export class ImportConfigurationError extends BaseImportError {
  public readonly statusCode = 400;
  public readonly errorCode = 'IMPORT_CONFIGURATION_ERROR';

  constructor(message: string, details: ApiErrorDetail[] = []) {
    super(message, details);
  }
}

export class ImportProcessingError extends BaseImportError {
  public readonly statusCode = 500;
  public readonly errorCode = 'IMPORT_PROCESSING_ERROR';

  constructor(message: string, details: ApiErrorDetail[] = []) {
    super(message, details);
  }
}

export class SecurityViolationError extends BaseImportError {
  public readonly statusCode = 403;
  public readonly errorCode = 'SECURITY_VIOLATION';

  constructor(message: string, details: ApiErrorDetail[] = []) {
    super(message, details);
  }
}
