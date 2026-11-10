/**
 * Core Data Import Service
 * Orchestrates entity lifecycle, state machine transitions, tenant validation, and audit recording.
 */
import { DataImportEntity } from '../entities/data-import.entity.js';
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IAuditService } from './audit.service.interface.js';
import { IEntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { ImportSourceType, ImportOptions, ImportFilterQuery, PaginatedResult } from '../../core/types/import.types.js';
import { SecurityContext } from '../../core/types/permissions.types.js';
export interface CreateImportInput {
    name: string;
    targetModule?: string;
    targetEntity: string;
    sourceType?: ImportSourceType;
    sourceId?: string;
    importOptions?: Partial<ImportOptions>;
}
export interface UpdateImportInput {
    name?: string;
    targetModule?: string;
    targetEntity?: string;
    importOptions?: Partial<ImportOptions>;
}
export declare class ImportService {
    private readonly repository;
    private readonly audit;
    private readonly schemaRegistry;
    constructor(repository: IDataImportRepository, audit: IAuditService, schemaRegistry?: IEntitySchemaRegistry);
    /**
     * Creates a new Data Import job in DRAFT state.
     */
    createImport(context: SecurityContext, input: CreateImportInput): Promise<DataImportEntity>;
    /**
     * Retrieves an import by ID ensuring tenant isolation.
     */
    getImport(context: SecurityContext, importId: string): Promise<DataImportEntity>;
    /**
     * Lists imports for the organization with pagination and filtering.
     */
    listImports(context: SecurityContext, query: ImportFilterQuery): Promise<PaginatedResult<DataImportEntity>>;
    /**
     * Updates an import draft or editable lifecycle state.
     */
    updateImport(context: SecurityContext, importId: string, input: UpdateImportInput): Promise<DataImportEntity>;
    /**
     * Persists an in-progress import as a resumable DRAFT.
     */
    saveDraft(context: SecurityContext, importId: string, currentStep?: number): Promise<DataImportEntity>;
    /**
     * Rollbacks changes of a given step from the backend.
     */
    revertStep(context: SecurityContext, importId: string, step: number): Promise<void>;
    /**
     * Cancels an import job using the state machine.
     */
    cancelImport(context: SecurityContext, importId: string, reason?: string): Promise<DataImportEntity>;
}
//# sourceMappingURL=import.service.d.ts.map