/**
 * Express Application Setup for Data Import Centre
 */
import { Express } from 'express';
import { IFileStorageService } from './infrastructure/storage/file-storage.service.js';
import { IDataImportRepository } from './domain/repositories/data-import.repository.interface.js';
import { IDataImportMappingRepository } from './domain/repositories/data-import-mapping.repository.interface.js';
import { IDataImportRecordRepository } from './domain/repositories/data-import-record.repository.interface.js';
import { IDataImportApprovalRepository } from './domain/repositories/data-import-approval.repository.interface.js';
import { IDataImportExecutionRepository } from './domain/repositories/data-import-execution.repository.interface.js';
import { IDataImportReconciliationRepository } from './domain/repositories/data-import-reconciliation.repository.interface.js';
import { ITargetMatchProviderRegistry } from './domain/duplicate/target-match-provider.interface.js';
import { IAuditService } from './domain/services/audit.service.interface.js';
export interface AppDependencies {
    repository?: IDataImportRepository;
    mappingRepository?: IDataImportMappingRepository;
    recordRepository?: IDataImportRecordRepository;
    approvalRepository?: IDataImportApprovalRepository;
    executionRepository?: IDataImportExecutionRepository;
    reconciliationRepository?: IDataImportReconciliationRepository;
    targetProviderRegistry?: ITargetMatchProviderRegistry;
    storage?: IFileStorageService;
    auditService?: IAuditService;
}
export declare function createApp(deps?: AppDependencies): Express;
//# sourceMappingURL=app.d.ts.map