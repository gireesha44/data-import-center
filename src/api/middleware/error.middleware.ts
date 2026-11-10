/**
 * Global Error Handling Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { BaseImportError } from '../../core/errors/import.errors.js';
import { logger } from '../../core/logging/structured-logger.js';
import { ApiErrorResponse } from '../../core/types/import.types.js';

export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Handle Known Domain / Application Errors
  if (err instanceof BaseImportError) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
        details: err.details.length > 0 ? err.details : undefined
      }
    };

    logger.warn(`Handled error [${err.errorCode}]: ${err.message}`, {
      statusCode: err.statusCode,
      importId: req.params?.id,
      organizationId: req.securityContext?.organizationId,
      operation: req.method + ' ' + req.originalUrl
    });

    res.status(err.statusCode).json(response);
    return;
  }

  // 2. Handle Zod Validation Errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      code: e.code,
      message: e.message
    }));

    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload or parameters',
        details
      }
    };

    logger.warn('Request validation failed', {
      statusCode: 400,
      operation: req.method + ' ' + req.originalUrl
    });

    res.status(400).json(response);
    return;
  }

  // 3. Handle Unexpected / Unhandled Internal Errors
  const internalError = err instanceof Error ? err : new Error(String(err));
  logger.error('Unhandled internal server error', internalError, {
    operation: req.method + ' ' + req.originalUrl,
    organizationId: req.securityContext?.organizationId
  });

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred. Please contact support.'
    }
  };

  res.status(500).json(response);
}
