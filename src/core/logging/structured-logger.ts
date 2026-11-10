/**
 * Structured Logger with PII and Credential Redaction for Data Import Centre
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  importId?: string;
  executionId?: string;
  organizationId?: string;
  userId?: string;
  operation?: string;
  durationMs?: number;
  statusCode?: number;
  [key: string]: unknown;
}

const REDACTED_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'apikey',
  'api_key',
  'bearer',
  'creditcard',
  'ssn',
  'credential',
  'credentials'
]);

function redactSensitiveData(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = redactSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class StructuredLogger {
  private moduleName: string;

  constructor(moduleName = 'DataImport') {
    this.moduleName = moduleName;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.moduleName,
      message,
      context: context ? redactSensitiveData(context) : undefined,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          }
        : undefined
    };

    const serialized = JSON.stringify(entry);
    if (level === 'ERROR') {
      console.error(serialized);
    } else if (level === 'WARN') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  public debug(message: string, context?: LogContext): void {
    this.log('DEBUG', message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.log('INFO', message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.log('WARN', message, context);
  }

  public error(message: string, error?: Error, context?: LogContext): void {
    this.log('ERROR', message, context, error);
  }
}

export const logger = new StructuredLogger();
