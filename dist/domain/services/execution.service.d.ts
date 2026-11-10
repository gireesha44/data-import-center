/**
 * Data Import Batch Execution Domain Service
 */
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { IDataImportExecutionRepository } from '../repositories/data-import-execution.repository.interface.js';
import { ApprovalService } from './approval.service.js';
import { ITargetMatchProviderRegistry } from '../duplicate/target-match-provider.interface.js';
import { IAuditService } from './audit.service.interface.js';
import { StructuredLogger } from '../../core/logging/structured-logger.js';
import { SecurityContext } from '../../core/types/permissions.types.js';
import { ExecutionSummaryDto, ExecutionPlan } from '../../core/types/execution.types.js';
export declare class ExecutionService {
    private importRepository;
    private recordRepository;
    private executionRepository;
    private approvalService;
    private targetProviderRegistry;
    private auditService;
    private logger;
    constructor(importRepository: IDataImportRepository, recordRepository: IDataImportRecordRepository, approvalService: ApprovalService, executionRepository?: IDataImportExecutionRepository, targetProviderRegistry?: ITargetMatchProviderRegistry, auditServiceInstance?: IAuditService, logger?: StructuredLogger);
    /**
     * Generates immutable execution plan from current staged state
     */
    generateExecutionPlan(organizationId: string, importId: string): Promise<ExecutionPlan>;
    /**
     * Executes transactional batch execution of staged import records
     */
    executeImport(context: SecurityContext, importId: string): Promise<ExecutionSummaryDto>;
    /**
     * Retrieves execution status and metrics
     */
    getExecutionStatus(context: SecurityContext, importId: string): Promise<ExecutionSummaryDto>;
    /**
     * Returns structured error summary for failed records
     */
    getErrorReport(context: SecurityContext, importId: string): Promise<{
        importId: string;
        totalErrors: number;
        failedRecords: unknown[];
    }>;
    private toSummaryDto;
}
//# sourceMappingURL=execution.service.d.ts.map