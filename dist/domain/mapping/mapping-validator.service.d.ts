/**
 * Column Mapping Validator Service
 */
import { EntitySchemaDefinition } from '../../core/registry/entity-schema.registry.js';
import { ColumnMapping, MappingValidationResult, SourceColumn } from '../../core/types/mapping.types.js';
export declare class MappingValidatorService {
    /**
     * Validates a column mapping configuration against an entity schema and source columns
     */
    static validate(mappings: Record<string, ColumnMapping>, schema: EntitySchemaDefinition, sourceColumns: SourceColumn[]): MappingValidationResult;
}
//# sourceMappingURL=mapping-validator.service.d.ts.map