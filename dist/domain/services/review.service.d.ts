/**
 * Data Import Review Domain Service
 */
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportMappingRepository } from '../repositories/data-import-mapping.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { ApprovalService } from './approval.service.js';
import { EntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { SecurityContext } from '../../core/types/permissions.types.js';
import { ReviewSummary, ReviewRecordItem, ReviewRecordDetail, ReviewFilterQuery } from '../../core/types/execution.types.js';
import { PaginatedResult } from '../../core/types/import.types.js';
export declare class ReviewService {
    private importRepository;
    private mappingRepository;
    private recordRepository;
    private approvalService;
    private schemaRegistry;
    constructor(importRepository: IDataImportRepository, mappingRepository: IDataImportMappingRepository, recordRepository: IDataImportRecordRepository, approvalService: ApprovalService, schemaRegistry?: EntitySchemaRegistry);
    /**
     * Generates authoritative server-side review summary and readiness checklist
     */
    getReviewSummary(context: SecurityContext, importId: string): Promise<ReviewSummary>;
    /**
     * Retrieves paginated review records
     */
    getReviewRecords(context: SecurityContext, importId: string, filter?: ReviewFilterQuery): Promise<PaginatedResult<ReviewRecordItem>>;
    /**
     * Retrieves deep detail for an individual staged record with before/after diffs
     */
    getRecordDetail(context: SecurityContext, importId: string, recordId: string): Promise<ReviewRecordDetail>;
}
//# sourceMappingURL=review.service.d.ts.map