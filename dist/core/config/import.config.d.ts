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
export declare const ImportConfigService: {
    get(): ImportConfig;
    update(overrides: Partial<ImportConfig>): void;
    reset(): void;
};
//# sourceMappingURL=import.config.d.ts.map