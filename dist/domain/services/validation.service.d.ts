/**
 * Validation Domain Service
 * Orchestrates multi-tier transformation and validation, staging persistence, and state transitions
 */
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportMappingRepository } from '../repositories/data-import-mapping.repository.interface.js';
import { IDataImportRecordRepository, RecordFilterOptions } from '../repositories/data-import-record.repository.interface.js';
import { IEntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { IAuditService } from '../services/audit.service.interface.js';
import { IFileStorageService } from '../../infrastructure/storage/file-storage.service.js';
import { ValidationEngine } from '../validation/validation.engine.js';
import { DataImportRecordEntity } from '../entities/data-import-record.entity.js';
import { SecurityContext } from '../../core/types/permissions.types.js';
import { ImportStatus, PaginatedResult } from '../../core/types/import.types.js';
import { ValidationSummary } from '../../core/types/validation.types.js';
import { ITargetMatchProviderRegistry } from '../duplicate/target-match-provider.interface.js';
export declare class ValidationService {
    private readonly importRepository;
    private readonly mappingRepository;
    private readonly recordRepository;
    private readonly schemaRegistry;
    private readonly auditService;
    private readonly storage;
    private readonly engine;
    private readonly targetProviderRegistry?;
    constructor(importRepository: IDataImportRepository, mappingRepository: IDataImportMappingRepository, recordRepository: IDataImportRecordRepository, schemaRegistry: IEntitySchemaRegistry, auditService: IAuditService, storage?: IFileStorageService, engine?: ValidationEngine, targetProviderRegistry?: ITargetMatchProviderRegistry | undefined);
    /**
     * Executes transformation and validation pipeline on all rows of an import job
     */
    validateImport(context: SecurityContext, importId: string): Promise<ValidationSummary>;
    /**
     * Returns the authoritative validation snapshot for the import wizard.
     */
    getValidationSummary(context: SecurityContext, importId: string): Promise<{
        status: ImportStatus;
        step: number;
        nextAllowedAction: string;
        canProceedToMatching: boolean;
        summary: ValidationSummary;
    }>;
    /**
     * Retrieves paginated preview of staged records with cell issues and status
     */
    getValidationPreview(context: SecurityContext, importId: string, options?: RecordFilterOptions): Promise<PaginatedResult<DataImportRecordEntity>>;
    /**
     * Applies user record correction, re-transforms, re-validates, and updates staged record & import statistics
     */
    correctRecord(context: SecurityContext, importId: string, recordId: string, field: string, newValue: unknown): Promise<{
        record: DataImportRecordEntity;
        summary: ValidationSummary;
    }>;
    correctRecordFields(context: SecurityContext, importId: string, recordId: string, fields: Record<string, unknown>): Promise<{
        record: DataImportRecordEntity;
        summary: ValidationSummary;
    }>;
    /**
     * Applies bulk correction to all staged records matching a target field and error/value condition
     */
    bulkCorrectRecords(context: SecurityContext, importId: string, field: string, oldValue: unknown, newValue: unknown, errorCode?: string): Promise<{
        correctedCount: number;
        summary: ValidationSummary;
    }>;
    private computeDetailedQualityStats;
}
//# sourceMappingURL=validation.service.d.ts.map