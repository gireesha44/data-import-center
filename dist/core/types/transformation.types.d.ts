/**
 * Core Type Definitions for Data Transformation Engine
 */
export type BuiltInTransformType = 'TRIM' | 'LOWERCASE' | 'UPPERCASE' | 'NULL_NORMALIZE' | 'TO_STRING' | 'TO_NUMBER' | 'TO_DECIMAL' | 'TO_BOOLEAN' | 'TO_DATE' | 'TO_DATETIME' | 'PHONE_FORMAT' | 'PREFIX' | 'SUFFIX' | 'DEFAULT_VALUE' | 'REGEX_REPLACE';
export interface TransformContext {
    organizationId: string;
    importId: string;
    targetEntity: string;
    targetField: string;
    sourceColumn: string;
    rowIndex: number;
    rowRawData?: Record<string, unknown>;
    options?: Record<string, unknown>;
}
export interface TransformDefinition {
    type: BuiltInTransformType | string;
    options?: Record<string, unknown>;
}
export interface ITransformation {
    readonly name: string;
    readonly description: string;
    execute(value: unknown, options?: Record<string, unknown>, context?: TransformContext): unknown;
}
export interface ColumnTransformationConfig {
    sourceColumn: string;
    targetField: string;
    transforms: TransformDefinition[];
    defaultValue?: unknown;
}
export interface TransformedValueResult {
    originalValue: unknown;
    transformedValue: unknown;
    appliedTransforms: string[];
    error?: string;
}
export interface TransformationAuditEntry {
    type: string;
    confidence: number;
    explanation: string;
}
//# sourceMappingURL=transformation.types.d.ts.map