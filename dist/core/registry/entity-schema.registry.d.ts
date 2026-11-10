/**
 * Entity Schema Registry for Data Import Centre
 * Single authoritative source of truth for importable entities and field metadata
 */
export type FieldDataType = 'STRING' | 'NUMBER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'EMAIL' | 'PHONE' | 'ENUM' | 'IDENTIFIER' | 'REFERENCE';
export interface FieldValidationRuleDefinition {
    rule: string;
    parameters?: Record<string, unknown>;
    message?: string;
    severity?: 'ERROR' | 'WARNING' | 'INFORMATION';
}
export interface FieldConstraints {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    sensitive?: boolean;
}
export interface EntityFieldDefinition {
    name: string;
    label: string;
    type: FieldDataType;
    required: boolean;
    nullable?: boolean;
    readOnly?: boolean;
    unique?: boolean;
    description?: string;
    example?: string;
    format?: string;
    enumValues?: string[];
    /** Explicit source/value aliases that may be safely normalized to enum values. */
    enumAliases?: Record<string, string>;
    aliases?: string[];
    referenceTarget?: {
        entity: string;
        lookupKey: string;
        valueKey: string;
    };
    validationRules?: FieldValidationRuleDefinition[];
    constraints?: FieldConstraints;
    defaultValue?: unknown;
}
export interface DuplicateRuleDefinition {
    name: string;
    fields: string[];
    strategy: 'EXACT_MATCH' | 'CASE_INSENSITIVE' | 'COMPOSITE';
    isDefault?: boolean;
}
export interface ApprovalPolicyDefinition {
    requiresApproval: boolean;
    thresholdRowCount?: number;
    restrictedRoles?: string[];
    requireForUpdateMode?: boolean;
    approverRoles?: string[];
    approverLabel?: string;
}
export interface EntitySchemaDefinition {
    module: string;
    entity: string;
    displayName: string;
    description?: string;
    version: number;
    isImportable?: boolean;
    fields: Record<string, EntityFieldDefinition>;
    duplicateRules: DuplicateRuleDefinition[];
    approvalPolicy?: ApprovalPolicyDefinition;
}
export interface IEntitySchemaRegistry {
    registerEntity(schema: EntitySchemaDefinition): void;
    getEntity(entityName: string): EntitySchemaDefinition | undefined;
    listEntities(): EntitySchemaDefinition[];
    hasEntity(entityName: string): boolean;
    getEntityFields(entityName: string): Record<string, EntityFieldDefinition>;
    getField(entityName: string, fieldName: string): EntityFieldDefinition | undefined;
    getRequiredFields(entityName: string): string[];
}
export declare class EntitySchemaRegistry implements IEntitySchemaRegistry {
    private schemas;
    registerEntity(schema: EntitySchemaDefinition): void;
    getEntity(entityName: string): EntitySchemaDefinition | undefined;
    listEntities(): EntitySchemaDefinition[];
    hasEntity(entityName: string): boolean;
    getEntityFields(entityName: string): Record<string, EntityFieldDefinition>;
    getField(entityName: string, fieldName: string): EntityFieldDefinition | undefined;
    getRequiredFields(entityName: string): string[];
    clear(): void;
}
export declare const entitySchemaRegistry: EntitySchemaRegistry;
//# sourceMappingURL=entity-schema.registry.d.ts.map