/**
 * Failed Record Controlled Retry Service
 */
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { IDataImportExecutionRepository } from '../repositories/data-import-execution.repository.interface.js';
import { ITargetMatchProviderRegistry } from '../duplicate/target-match-provider.interface.js';
import { ReconciliationService } from './reconciliation.service.js';
import { ReportingService } from './reporting.service.js';
import { RetryImportOptions, RetryExecutionResult } from '../../core/types/reconciliation.types.js';
import { SecurityContext } from '../../core/types/permissions.types.js';
import { IAuditService } from './audit.service.interface.js';
import { StructuredLogger } from '../../core/logging/structured-logger.js';
import { MetricsService } from './metrics.service.js';
export declare class RetryService {
    private readonly importRepository;
    private readonly recordRepository;
    private readonly executionRepository;
    private readonly targetRegistry;
    private readonly reconciliationService;
    private readonly reportingService;
    private readonly auditServiceInstance;
    private readonly logger;
    private readonly metrics;
    constructor(importRepository: IDataImportRepository, recordRepository: IDataImportRecordRepository, executionRepository: IDataImportExecutionRepository, targetRegistry: ITargetMatchProviderRegistry, reconciliationService: ReconciliationService, reportingService: ReportingService, auditServiceInstance?: IAuditService, logger?: StructuredLogger, metrics?: MetricsService);
    /**
     * Safely retries eligible failed records with retry limit enforcement
     */
    retryFailedRecords(context: SecurityContext, importId: string, options?: RetryImportOptions): Promise<RetryExecutionResult>;
}
//# sourceMappingURL=retry.service.d.ts.map