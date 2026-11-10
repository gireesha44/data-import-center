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
export declare class StructuredLogger {
    private moduleName;
    constructor(moduleName?: string);
    private log;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, error?: Error, context?: LogContext): void;
}
export declare const logger: StructuredLogger;
//# sourceMappingURL=structured-logger.d.ts.map