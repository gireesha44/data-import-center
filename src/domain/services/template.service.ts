/**
 * Template Service for Data Import Centre
 * Schema-driven generator for CSV and multi-sheet XLSX import templates
 */

import * as XLSX from 'xlsx';
import { IEntitySchemaRegistry, EntityFieldDefinition, EntitySchemaDefinition } from '../../core/registry/entity-schema.registry.js';
import { NotFoundError, ValidationError } from '../../core/errors/import.errors.js';

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
  validateTemplateHeaders(entityName: string, headers: string[]): { isValid: boolean; missingRequired: string[]; unknownFields: string[] };
}

export class TemplateService implements ITemplateService {
  constructor(private readonly schemaRegistry: IEntitySchemaRegistry) {}

  /**
   * Retrieves user-facing template metadata for an entity schema.
   * Excludes system-generated / read-only fields.
   */
  public getTemplateMetadata(entityName: string): TemplateMetadata {
    const schema = this.getSchemaOrThrow(entityName);
    const importableFields = this.getImportableFields(schema);

    const requiredFields: string[] = [];
    const optionalFields: string[] = [];
    const fieldsMeta: TemplateFieldMeta[] = [];

    for (const field of importableFields) {
      if (field.required) {
        requiredFields.push(field.name);
      } else {
        optionalFields.push(field.name);
      }

      fieldsMeta.push({
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required,
        nullable: field.nullable ?? !field.required,
        unique: field.unique ?? false,
        description: field.description || '',
        example: field.example || '',
        enumValues: field.enumValues,
        defaultValue: field.defaultValue
      });
    }

    return {
      entity: schema.entity,
      module: schema.module,
      displayName: schema.displayName,
      description: schema.description,
      version: schema.version,
      totalFields: importableFields.length,
      requiredCount: requiredFields.length,
      optionalCount: optionalFields.length,
      requiredFields,
      optionalFields,
      fields: fieldsMeta
    };
  }

  /**
   * Generates a clean CSV template string with headers and an example row.
   */
  public generateCsvTemplate(entityName: string): string {
    const schema = this.getSchemaOrThrow(entityName);
    const importableFields = this.getImportableFields(schema);

    const headers = importableFields.map((f) => f.name);
    const exampleValues = importableFields.map((f) => {
      const val = f.example ?? f.defaultValue ?? '';
      const strVal = String(val);
      // Escape CSV field if it contains commas, quotes, or newlines
      if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
        return `"${strVal.replace(/"/g, '""')}"`;
      }
      return strVal;
    });

    return `${headers.join(',')}\n${exampleValues.join(',')}\n`;
  }

  /**
   * Generates a multi-sheet XLSX template workbook as a Buffer.
   * Sheet 1: IMPORT_TEMPLATE (headers + example)
   * Sheet 2: FIELD_GUIDE (field metadata table)
   * Sheet 3: ALLOWED_VALUES (enum lookup table if enums present)
   */
  public generateXlsxTemplate(entityName: string): Buffer {
    const schema = this.getSchemaOrThrow(entityName);
    const importableFields = this.getImportableFields(schema);

    const workbook = XLSX.utils.book_new();

    // Sheet 1: IMPORT_TEMPLATE
    const templateHeaders = importableFields.map((f) => f.name);
    const exampleRow: Record<string, unknown> = {};
    for (const f of importableFields) {
      exampleRow[f.name] = f.example ?? f.defaultValue ?? '';
    }
    const importSheet = XLSX.utils.json_to_sheet([exampleRow], { header: templateHeaders });
    XLSX.utils.book_append_sheet(workbook, importSheet, 'IMPORT_TEMPLATE');

    // Sheet 2: FIELD_GUIDE
    const guideRows = importableFields.map((f) => ({
      'Field Name': f.name,
      'Display Name': f.label,
      'Required': f.required ? 'YES' : 'NO',
      'Data Type': f.type,
      'Description': f.description || '',
      'Example Value': f.example || '',
      'Allowed Values': f.enumValues ? f.enumValues.join(', ') : 'N/A'
    }));
    const guideSheet = XLSX.utils.json_to_sheet(guideRows);
    XLSX.utils.book_append_sheet(workbook, guideSheet, 'FIELD_GUIDE');

    // Sheet 3: ALLOWED_VALUES (if enums exist)
    const enumFields = importableFields.filter((f) => f.type === 'ENUM' && f.enumValues && f.enumValues.length > 0);
    if (enumFields.length > 0) {
      const enumRows: Record<string, string>[] = [];
      // Find max enum values length
      const maxLen = Math.max(...enumFields.map((f) => f.enumValues!.length));
      for (let i = 0; i < maxLen; i++) {
        const row: Record<string, string> = {};
        for (const ef of enumFields) {
          row[`${ef.label} (${ef.name})`] = ef.enumValues![i] || '';
        }
        enumRows.push(row);
      }
      const allowedValuesSheet = XLSX.utils.json_to_sheet(enumRows);
      XLSX.utils.book_append_sheet(workbook, allowedValuesSheet, 'ALLOWED_VALUES');
    }

    const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(xlsxBuffer);
  }

  /**
   * Validates header row array against entity schema requirements.
   */
  public validateTemplateHeaders(
    entityName: string,
    headers: string[]
  ): { isValid: boolean; missingRequired: string[]; unknownFields: string[] } {
    const schema = this.getSchemaOrThrow(entityName);
    const importableFields = this.getImportableFields(schema);
    const headerSet = new Set(headers.map((h) => h.trim().toLowerCase()));

    const missingRequired: string[] = [];
    for (const field of importableFields) {
      if (field.required) {
        const matched = headerSet.has(field.name.toLowerCase()) ||
          (field.aliases && field.aliases.some((a) => headerSet.has(a.toLowerCase())));
        if (!matched) {
          missingRequired.push(field.name);
        }
      }
    }

    const knownNamesAndAliases = new Set<string>();
    for (const f of importableFields) {
      knownNamesAndAliases.add(f.name.toLowerCase());
      if (f.aliases) {
        for (const a of f.aliases) {
          knownNamesAndAliases.add(a.toLowerCase());
        }
      }
    }

    const unknownFields: string[] = [];
    for (const header of headers) {
      const hLower = header.trim().toLowerCase();
      if (hLower && !knownNamesAndAliases.has(hLower)) {
        unknownFields.push(header);
      }
    }

    return {
      isValid: missingRequired.length === 0,
      missingRequired,
      unknownFields
    };
  }

  private getSchemaOrThrow(entityName: string): EntitySchemaDefinition {
    if (!entityName) {
      throw new ValidationError('Entity name is required to get template');
    }
    const schema = this.schemaRegistry.getEntity(entityName);
    if (!schema) {
      throw new NotFoundError(`Entity schema for '${entityName}' not found in registry`);
    }
    return schema;
  }

  private getImportableFields(schema: EntitySchemaDefinition): EntityFieldDefinition[] {
    return Object.values(schema.fields).filter((f) => !f.readOnly);
  }
}
