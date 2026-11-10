/**
 * Post-Execution Reconciliation Domain Service
 */
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { IDataImportExecutionRepository } from '../repositories/data-import-execution.repository.interface.js';
import { IDataImportReconciliationRepository } from '../repositories/data-import-reconciliation.repository.interface.js';
import { DataImportReconciliationEntity } from '../entities/data-import-reconciliation.entity.js';
import { ReconciliationResult } from '../../core/types/reconciliation.types.js';
import { SecurityContext } from '../../core/types/permissions.types.js';
import { IAuditService } from './audit.service.interface.js';
import { StructuredLogger } from '../../core/logging/structured-logger.js';
import { MetricsService } from './metrics.service.js';
export declare class ReconciliationService {
    private readonly importRepository;
    private readonly recordRepository;
    private readonly executionRepository;
    private readonly reconciliationRepository;
    private readonly auditServiceInstance;
    private readonly logger;
    private readonly metrics;
    constructor(importRepository: IDataImportRepository, recordRepository: IDataImportRecordRepository, executionRepository: IDataImportExecutionRepository, reconciliationRepository: IDataImportReconciliationRepository, auditServiceInstance?: IAuditService, logger?: StructuredLogger, metrics?: MetricsService);
    /**
     * Reconciles intended execution actions against actual staged record outcomes
     */
    reconcileImport(context: SecurityContext, importId: string): Promise<ReconciliationResult>;
    /**
     * Retrieves latest reconciliation result for an import job
     */
    getLatestReconciliation(organizationId: string, importId: string): Promise<DataImportReconciliationEntity | null>;
}
//# sourceMappingURL=reconciliation.service.d.ts.map