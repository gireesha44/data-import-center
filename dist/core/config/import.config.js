/**
 * Centralized Configuration for Data Import Centre
 */
import { ImportFileFormat, ImportSourceType } from '../types/import.types.js';
const DEFAULT_CONFIG = {
    maxFileSizeBytes: 100 * 1024 * 1024, // 100 MB
    maxRecordsCount: 500000, // 500,000 records
    defaultBatchSize: 500, // 500 records per transaction batch
    maxBatchSize: 2000, // Max 2,000 records per batch
    tempStoragePath: process.env.IMPORT_TEMP_PATH || './temp/imports',
    allowedSourceTypes: [
        ImportSourceType.FILE_UPLOAD,
        ImportSourceType.REST_API,
        ImportSourceType.WEBHOOK,
        ImportSourceType.INTERNAL_QUERY,
        ImportSourceType.SCHEDULED_SYNC
    ],
    allowedFileFormats: [
        ImportFileFormat.CSV,
        ImportFileFormat.XLSX,
        ImportFileFormat.XLS,
        ImportFileFormat.JSON,
        ImportFileFormat.XML
    ],
    allowedMimeTypes: [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/json',
        'application/xml',
        'text/xml',
        'text/plain'
    ],
    processingTimeoutMs: 3600000, // 1 hour
    maxRetryAttempts: 3,
    enableAuditLogging: true,
    enableAiAssistance: false
};
let currentConfig = { ...DEFAULT_CONFIG };
export const ImportConfigService = {
    get() {
        return { ...currentConfig };
    },
    update(overrides) {
        currentConfig = {
            ...currentConfig,
            ...overrides
        };
    },
    reset() {
        currentConfig = { ...DEFAULT_CONFIG };
    }
};
//# sourceMappingURL=import.config.js.map