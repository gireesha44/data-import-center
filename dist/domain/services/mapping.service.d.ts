/**
 * Column Mapping Domain Service
 * Orchestrates mapping suggestions, manual mapping, validation, and lifecycle persistence
 */
import { IDataImportRepository } from '../repositories/data-import.repository.interface.js';
import { IDataImportMappingRepository } from '../repositories/data-import-mapping.repository.interface.js';
import { IDataImportRecordRepository } from '../repositories/data-import-record.repository.interface.js';
import { IEntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { IAuditService } from '../services/audit.service.interface.js';
import { IMappingSuggestionProvider } from '../mapping/mapping-suggestion.provider.js';
import { MappingSuggestionResult, MappingValidationResult, SaveMappingInput } from '../../core/types/mapping.types.js';
import { DataImportMappingEntity } from '../entities/data-import-mapping.entity.js';
import { SecurityContext } from '../../core/types/permissions.types.js';
import { IAiMappingProvider } from '../mapping/ai-mapping.provider.js';
export declare class MappingService {
    private readonly importRepository;
    private readonly mappingRepository;
    private readonly schemaRegistry;
    private readonly auditService;
    private readonly recordRepository?;
    private readonly suggestionProvider;
    private readonly aiMappingProvider;
    constructor(importRepository: IDataImportRepository, mappingRepository: IDataImportMappingRepository, schemaRegistry: IEntitySchemaRegistry, auditService: IAuditService, recordRepository?: IDataImportRecordRepository | undefined, suggestionProvider?: IMappingSuggestionProvider, aiMappingProvider?: IAiMappingProvider);
    /**
     * Generates automatic mapping suggestions based on parsed headers and target entity schema
     */
    getSuggestions(context: SecurityContext, importId: string): Promise<MappingSuggestionResult>;
    /**
     * Retrieves the current saved mapping for an import job
     */
    getMapping(context: SecurityContext, importId: string): Promise<{
        mapping: DataImportMappingEntity | null;
        validation?: MappingValidationResult;
    }>;
    /**
     * Saves or updates a column mapping definition and validates completeness
     */
    saveMapping(context: SecurityContext, importId: string, input: SaveMappingInput): Promise<{
        mapping: DataImportMappingEntity;
        validation: MappingValidationResult;
    }>;
    /**
     * Validates a candidate mapping against entity schema without persisting
     */
    validateMapping(context: SecurityContext, importId: string, input?: SaveMappingInput): Promise<MappingValidationResult>;
    /**
     * Clears saved mapping for an import job
     */
    clearMapping(context: SecurityContext, importId: string): Promise<void>;
    /**
     * Extracts source columns from import metadata
     */
    private extractSourceColumnsFromImport;
    private serializeColumnMappings;
    private deserializeColumnMappings;
}
//# sourceMappingURL=mapping.service.d.ts.map