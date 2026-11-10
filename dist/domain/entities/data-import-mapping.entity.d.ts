/**
 * Data Import Mapping Domain Entity
 */
export interface SourceColumnInfo {
    index: number;
    header: string;
    sampleValues: string[];
}
export interface ColumnMappingDefinition {
    sourceColumn: string;
    targetField: string;
    targetType: string;
    required: boolean;
    transformations?: string[];
    defaultValue?: unknown;
}
export interface DataImportMappingProps {
    id: string;
    organizationId: string;
    importId: string;
    sourceColumns?: SourceColumnInfo[];
    columnMappings?: Record<string, ColumnMappingDefinition>;
    transformations?: Record<string, unknown[]>;
    defaultValues?: Record<string, unknown>;
    unmappedBehavior?: 'IGNORE' | 'SET_NULL';
    isValid?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
export declare class DataImportMappingEntity {
    readonly id: string;
    readonly organizationId: string;
    readonly importId: string;
    sourceColumns: SourceColumnInfo[];
    columnMappings: Record<string, ColumnMappingDefinition>;
    transformations: Record<string, unknown[]>;
    defaultValues: Record<string, unknown>;
    unmappedBehavior: 'IGNORE' | 'SET_NULL';
    isValid: boolean;
    readonly createdAt: Date;
    updatedAt: Date;
    constructor(props: DataImportMappingProps);
    toJSON(): {
        id: string;
        organizationId: string;
        importId: string;
        sourceColumns: SourceColumnInfo[];
        columnMappings: Record<string, ColumnMappingDefinition>;
        transformations: Record<string, unknown[]>;
        defaultValues: Record<string, unknown>;
        unmappedBehavior: "IGNORE" | "SET_NULL";
        isValid: boolean;
        createdAt: string;
        updatedAt: string;
    };
}
//# sourceMappingURL=data-import-mapping.entity.d.ts.map