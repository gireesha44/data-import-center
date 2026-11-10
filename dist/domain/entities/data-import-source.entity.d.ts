/**
 * Data Import Source Domain Entity
 */
import { ImportSourceType, ImportFileFormat } from '../../core/types/import.types.js';
export interface DataImportSourceProps {
    id: string;
    organizationId: string;
    name: string;
    sourceType: ImportSourceType;
    fileFormat?: ImportFileFormat | null;
    connectionConfig?: Record<string, unknown>;
    isActive?: boolean;
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
}
export declare class DataImportSourceEntity {
    readonly id: string;
    readonly organizationId: string;
    name: string;
    sourceType: ImportSourceType;
    fileFormat: ImportFileFormat | null;
    connectionConfig: Record<string, unknown>;
    isActive: boolean;
    readonly createdBy: string;
    readonly createdAt: Date;
    updatedAt: Date;
    constructor(props: DataImportSourceProps);
    toJSON(): {
        id: string;
        organizationId: string;
        name: string;
        sourceType: ImportSourceType;
        fileFormat: ImportFileFormat | null;
        isActive: boolean;
        createdBy: string;
        createdAt: string;
        updatedAt: string;
    };
}
//# sourceMappingURL=data-import-source.entity.d.ts.map