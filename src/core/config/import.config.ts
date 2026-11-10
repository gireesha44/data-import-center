/**
 * Centralized Configuration for Data Import Centre
 */

import { ImportFileFormat, ImportSourceType } from '../types/import.types.js';

export interface ImportConfig {
  maxFileSizeBytes: number;
  maxRecordsCount: number;
  defaultBatchSize: number;
  maxBatchSize: number;
  tempStoragePath: string;
  allowedSourceTypes: ImportSourceType[];
  allowedFileFormats: ImportFileFormat[];
  allowedMimeTypes: string[];
  processingTimeoutMs: number;
  maxRetryAttempts: number;
  enableAuditLogging: boolean;
  enableAiAssistance: boolean;
}

const DEFAULT_CONFIG: ImportConfig = {
  maxFileSizeBytes: 100 * 1024 * 1024, // 100 MB
  maxRecordsCount: 500000,             // 500,000 records
  defaultBatchSize: 500,               // 500 records per transaction batch
  maxBatchSize: 2000,                  // Max 2,000 records per batch
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

let currentConfig: ImportConfig = { ...DEFAULT_CONFIG };

export const ImportConfigService = {
  get(): ImportConfig {
    return { ...currentConfig };
  },

  update(overrides: Partial<ImportConfig>): void {
    currentConfig = {
      ...currentConfig,
      ...overrides
    };
  },

  reset(): void {
    currentConfig = { ...DEFAULT_CONFIG };
  }
};
