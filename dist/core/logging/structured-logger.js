/**
 * Structured Logger with PII and Credential Redaction for Data Import Centre
 */
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
function redactSensitiveData(obj) {
    if (obj === null || obj === undefined)
        return obj;
    if (typeof obj !== 'object')
        return obj;
    if (Array.isArray(obj)) {
        return obj.map(redactSensitiveData);
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (REDACTED_KEYS.has(key.toLowerCase())) {
            sanitized[key] = '[REDACTED]';
        }
        else if (typeof value === 'object' && value !== null) {
            sanitized[key] = redactSensitiveData(value);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
export class StructuredLogger {
    moduleName;
    constructor(moduleName = 'DataImport') {
        this.moduleName = moduleName;
    }
    log(level, message, context, error) {
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
        }
        else if (level === 'WARN') {
            console.warn(serialized);
        }
        else {
            console.log(serialized);
        }
    }
    debug(message, context) {
        this.log('DEBUG', message, context);
    }
    info(message, context) {
        this.log('INFO', message, context);
    }
    warn(message, context) {
        this.log('WARN', message, context);
    }
    error(message, error, context) {
        this.log('ERROR', message, context, error);
    }
}
export const logger = new StructuredLogger();
//# sourceMappingURL=structured-logger.js.map