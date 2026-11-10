/**
 * Data Import Approval Domain Service
 */
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportApprovalRepository } from '../repositories/data-import-approval.repository.interface.js';
import { IDataImportMappingRepository } from '../repositories/data-import-mapping.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { EntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { IAuditService } from './audit.service.interface.js';
import { StructuredLogger } from '../../core/logging/structured-logger.js';
import { SecurityContext } from '../../core/types/permissions.types.js';
import { DataImportApprovalEntity } from '../entities/data-import-approval.entity.js';
export declare class ApprovalService {
    private importRepository;
    private approvalRepository;
    private mappingRepository;
    private recordRepository;
    private schemaRegistry;
    private auditService;
    private logger;
    constructor(importRepository: IDataImportRepository, mappingRepository: IDataImportMappingRepository, recordRepository: IDataImportRecordRepository, approvalRepository?: IDataImportApprovalRepository, schemaRegistry?: EntitySchemaRegistry, auditServiceInstance?: IAuditService, logger?: StructuredLogger);
    /**
     * Evaluates whether an import job requires explicit approval based on entity schema policies
     */
    evaluateApprovalPolicy(organizationId: string, importId: string): Promise<{
        requiresApproval: boolean;
        reasons: string[];
        approverRoles: string[];
        approverLabel: string;
    }>;
    /**
     * Submits a ready import to an alternate role configured by its entity policy.
     */
    submitForApproval(context: SecurityContext, importId: string): Promise<DataImportApprovalEntity>;
    private assertAssignedApprover;
    /**
     * Computes a deterministic cryptographic SHA-256 snapshot hash representing current state
     */
    computeSnapshotHash(organizationId: string, importId: string): Promise<string>;
    /**
     * Approves an import job for batch execution
     */
    approveImport(context: SecurityContext, importId: string, comment?: string): Promise<DataImportApprovalEntity>;
    /**
     * Rejects an import job
     */
    rejectImport(context: SecurityContext, importId: string, reason: string): Promise<DataImportApprovalEntity>;
    /**
     * Invalidates approval upon material modification
     */
    invalidateApproval(organizationId: string, importId: string, invalidationReason: string): Promise<void>;
    getLatestApproval(organizationId: string, importId: string): Promise<DataImportApprovalEntity | null>;
}
//# sourceMappingURL=approval.service.d.ts.map