/**
 * Data Import Template Domain Entity
 */
import { ColumnMappingDefinition } from './data-import-mapping.entity.js';
export interface DataImportTemplateProps {
    id: string;
    organizationId: string;
    targetModule: string;
    targetEntity: string;
    name: string;
    description?: string | null;
    version?: number;
    columnMappings?: Record<string, ColumnMappingDefinition>;
    transformations?: Record<string, unknown[]>;
    defaultValues?: Record<string, unknown>;
    isPublic?: boolean;
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
}
export declare class DataImportTemplateEntity {
    readonly id: string;
    readonly organizationId: string;
    targetModule: string;
    targetEntity: string;
    name: string;
    description: string | null;
    version: number;
    columnMappings: Record<string, ColumnMappingDefinition>;
    transformations: Record<string, unknown[]>;
    defaultValues: Record<string, unknown>;
    isPublic: boolean;
    readonly createdBy: string;
    readonly createdAt: Date;
    updatedAt: Date;
    constructor(props: DataImportTemplateProps);
    toJSON(): {
        id: string;
        organizationId: string;
        targetModule: string;
        targetEntity: string;
        name: string;
        description: string | null;
        version: number;
        columnMappings: Record<string, ColumnMappingDefinition>;
        transformations: Record<string, unknown[]>;
        defaultValues: Record<string, unknown>;
        isPublic: boolean;
        createdBy: string;
        createdAt: string;
        updatedAt: string;
    };
}
//# sourceMappingURL=data-import-template.entity.d.ts.map