/**
 * Final Reporting & Export Domain Service with CSV Formula Injection Defense
 */
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { IDataImportExecutionRepository } from '../repositories/data-import-execution.repository.interface.js';
import { IDataImportReconciliationRepository } from '../repositories/data-import-reconciliation.repository.interface.js';
import { PaginatedResult } from '../../core/types/import.types.js';
import { FinalImportReport, FailedRecordItem, FailedRecordsFilterQuery, ErrorCategory, Retryability } from '../../core/types/reconciliation.types.js';
import { SecurityContext } from '../../core/types/permissions.types.js';
export declare class ReportingService {
    private readonly importRepository;
    private readonly recordRepository;
    private readonly executionRepository;
    private readonly reconciliationRepository;
    constructor(importRepository: IDataImportRepository, recordRepository: IDataImportRecordRepository, executionRepository: IDataImportExecutionRepository, reconciliationRepository: IDataImportReconciliationRepository);
    /**
     * Generates comprehensive 5-tier final import report
     */
    getFinalReport(context: SecurityContext, importId: string): Promise<FinalImportReport>;
    /**
     * Retrieves paginated failed records with categorized error codes & retryability status
     */
    getFailedRecords(context: SecurityContext, importId: string, query?: FailedRecordsFilterQuery): Promise<PaginatedResult<FailedRecordItem>>;
    /**
     * Generates downloadable report or CSV export with CSV Formula Injection Defense
     */
    exportReport(context: SecurityContext, importId: string, format?: 'json' | 'csv' | 'pdf' | 'docx'): Promise<{
        contentType: string;
        filename: string;
        content: string | Buffer;
    }>;
    /**
     * Generates downloadable CSV of failed records with Formula Injection Defense
     */
    exportFailedRecordsCsv(context: SecurityContext, importId: string): Promise<{
        contentType: string;
        filename: string;
        content: string;
    }>;
    /**
     * Defensive CSV Formula Injection Sanitizer
     * Escapes dangerous formula prefixes: =, +, -, @, \t, \r
     */
    sanitizeCsvField(value: unknown): string;
    categorizeError(code: string): ErrorCategory;
    evaluateRetryability(code: string): Retryability;
}
//# sourceMappingURL=reporting.service.d.ts.map