/**
 * Template Service for Data Import Centre
 * Schema-driven generator for CSV and multi-sheet XLSX import templates
 */
import { IEntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
export interface TemplateFieldMeta {
    name: string;
    label: string;
    type: string;
    required: boolean;
    nullable: boolean;
    unique: boolean;
    description: string;
    example: string;
    enumValues?: string[];
    defaultValue?: unknown;
}
export interface TemplateMetadata {
    entity: string;
    module: string;
    displayName: string;
    description?: string;
    version: number;
    totalFields: number;
    requiredCount: number;
    optionalCount: number;
    requiredFields: string[];
    optionalFields: string[];
    fields: TemplateFieldMeta[];
}
export interface ITemplateService {
    getTemplateMetadata(entityName: string): TemplateMetadata;
    generateCsvTemplate(entityName: string): string;
    generateXlsxTemplate(entityName: string): Buffer;
    validateTemplateHeaders(entityName: string, headers: string[]): {
        isValid: boolean;
        missingRequired: string[];
        unknownFields: string[];
    };
}
export declare class TemplateService implements ITemplateService {
    private readonly schemaRegistry;
    constructor(schemaRegistry: IEntitySchemaRegistry);
    /**
     * Retrieves user-facing template metadata for an entity schema.
     * Excludes system-generated / read-only fields.
     */
    getTemplateMetadata(entityName: string): TemplateMetadata;
    /**
     * Generates a clean CSV template string with headers and an example row.
     */
    generateCsvTemplate(entityName: string): string;
    /**
     * Generates a multi-sheet XLSX template workbook as a Buffer.
     * Sheet 1: IMPORT_TEMPLATE (headers + example)
     * Sheet 2: FIELD_GUIDE (field metadata table)
     * Sheet 3: ALLOWED_VALUES (enum lookup table if enums present)
     */
    generateXlsxTemplate(entityName: string): Buffer;
    /**
     * Validates header row array against entity schema requirements.
     */
    validateTemplateHeaders(entityName: string, headers: string[]): {
        isValid: boolean;
        missingRequired: string[];
        unknownFields: string[];
    };
    private getSchemaOrThrow;
    private getImportableFields;
}
//# sourceMappingURL=template.service.d.ts.map