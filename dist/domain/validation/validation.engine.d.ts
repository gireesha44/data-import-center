/**
 * Multi-Tier Validation Engine
 * Coordinates Field (Tier 2), Cross-Field (Tier 3), and Business Rule (Tier 4) validation
 */
import { EntitySchemaDefinition } from '../../core/registry/entity-schema.registry.js';
import { RowValidationResult, ValidationSummary } from '../../core/types/validation.types.js';
import { EntityValidatorRegistry } from './entity-validator.registry.js';
import { TransformationPipeline } from '../transformation/transformation.pipeline.js';
import { DataImportMappingEntity } from '../entities/data-import-mapping.entity.js';
export declare class ValidationEngine {
    private readonly entityValidators;
    private readonly pipeline;
    private fieldValidators;
    private crossFieldValidators;
    constructor(entityValidators?: EntityValidatorRegistry, pipeline?: TransformationPipeline);
    /**
     * Validates a single transformed row against all validation tiers
     */
    validateRow(rowIndex: number, rawData: Record<string, unknown>, transformedData: Record<string, unknown>, transformationErrors: Record<string, string>, schema: EntitySchemaDefinition, contextInfo: {
        organizationId: string;
        importId: string;
    }): RowValidationResult;
    /**
     * Transforms and validates an entire dataset batch
     */
    validateDataset(rawRows: Record<string, unknown>[], mapping: DataImportMappingEntity, schema: EntitySchemaDefinition, contextInfo: {
        organizationId: string;
        importId: string;
    }, existingDbValuesByField?: Record<string, Set<string>>): {
        summary: ValidationSummary;
        results: RowValidationResult[];
    };
    /**
     * Enforces schema-defined unique field rules across the dataset batch.
     * Checks Level A: Duplicates within the uploaded file (on normalized values).
     * Checks Level B: Duplicates against existing database records (optional set).
     */
    applyUniquenessValidation(results: RowValidationResult[], schema: EntitySchemaDefinition, existingDbValuesByField?: Record<string, Set<string>>): void;
    private recalculateRowStatus;
}
export declare const validationEngine: ValidationEngine;
//# sourceMappingURL=validation.engine.d.ts.map