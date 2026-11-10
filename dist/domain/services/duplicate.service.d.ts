/**
 * Duplicate Detection and Record Matching Domain Service
 */
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { ITargetMatchProviderRegistry } from '../duplicate/target-match-provider.interface.js';
import { EntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { IAuditService } from './audit.service.interface.js';
import { StructuredLogger } from '../../core/logging/structured-logger.js';
import { SecurityContext } from '../../core/types/permissions.types.js';
import { DuplicateSummary, DuplicatePreviewItem, MatchPreviewQuery } from '../../core/types/duplicate.types.js';
import { PaginatedResult, DuplicateStrategy } from '../../core/types/import.types.js';
export declare class DuplicateService {
    private importRepository;
    private recordRepository;
    private targetProviderRegistry;
    private schemaRegistry;
    private auditService;
    private logger;
    constructor(importRepository: IDataImportRepository, recordRepository: IDataImportRecordRepository, targetProviderRegistry?: ITargetMatchProviderRegistry, schemaRegistry?: EntitySchemaRegistry, auditServiceInstance?: IAuditService, logger?: StructuredLogger);
    /**
     * Evaluates and classifies duplicate status & execution intent for all staged records.
     * @param overrideStrategy - when provided, supersedes the strategy stored on the import job
     *   for this detection run AND persists it so subsequent execution uses the same strategy.
     */
    detectDuplicates(context: SecurityContext, importId: string, overrideStrategy?: DuplicateStrategy): Promise<DuplicateSummary>;
    /**
  
     * Retrieves paginated, filterable match preview
     */
    getMatchPreview(context: SecurityContext, importId: string, query: MatchPreviewQuery): Promise<PaginatedResult<DuplicatePreviewItem>>;
    /**
     * Resolves a specific duplicate record with an action (SKIP, UPDATE, SEND_FOR_REVIEW)
     */
    resolveRecord(context: SecurityContext, importId: string, recordId: string, resolutionAction: 'SKIP' | 'REJECT' | 'UPDATE' | 'EDIT', rejectionReason?: string): Promise<DuplicateSummary>;
}
//# sourceMappingURL=duplicate.service.d.ts.map