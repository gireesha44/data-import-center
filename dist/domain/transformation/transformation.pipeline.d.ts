/**
 * Deterministic Transformation Pipeline
 * Sequentially executes transformations per column with bound enforcement
 */
import { TransformContext, TransformedValueResult, TransformationAuditEntry } from '../../core/types/transformation.types.js';
import { ITransformationRegistry } from './transformation.registry.js';
import { EntitySchemaDefinition } from '../../core/registry/entity-schema.registry.js';
import { DataImportMappingEntity } from '../entities/data-import-mapping.entity.js';
export interface TransformedRowResult {
    rowIndex: number;
    rawData: Record<string, unknown>;
    transformedData: Record<string, unknown>;
    transformationErrors: Record<string, string>;
    transformationAudit: Record<string, TransformationAuditEntry[]>;
}
export declare class TransformationPipeline {
    private readonly registry;
    private readonly MAX_TRANSFORM_CHAIN_LENGTH;
    constructor(registry?: ITransformationRegistry);
    /**
     * Transforms an individual cell value through a chain of configured transformations
     */
    transformValue(value: unknown, transforms: {
        type: string;
        options?: Record<string, unknown>;
    }[], context: TransformContext): TransformedValueResult;
    /**
     * Transforms a full source row using the import mapping and target entity schema
     */
    transformRow(rowIndex: number, rawRow: Record<string, unknown>, mapping: DataImportMappingEntity, schema: EntitySchemaDefinition, contextInfo: {
        organizationId: string;
        importId: string;
    }): TransformedRowResult;
    private explainTransformation;
}
export declare const transformationPipeline: TransformationPipeline;
//# sourceMappingURL=transformation.pipeline.d.ts.map