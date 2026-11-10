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

export class DataImportTemplateEntity {
  public readonly id: string;
  public readonly organizationId: string;
  public targetModule: string;
  public targetEntity: string;
  public name: string;
  public description: string | null;
  public version: number;
  public columnMappings: Record<string, ColumnMappingDefinition>;
  public transformations: Record<string, unknown[]>;
  public defaultValues: Record<string, unknown>;
  public isPublic: boolean;
  public readonly createdBy: string;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: DataImportTemplateProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.targetModule = props.targetModule;
    this.targetEntity = props.targetEntity;
    this.name = props.name;
    this.description = props.description ?? null;
    this.version = props.version ?? 1;
    this.columnMappings = props.columnMappings ?? {};
    this.transformations = props.transformations ?? {};
    this.defaultValues = props.defaultValues ?? {};
    this.isPublic = props.isPublic ?? false;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  public toJSON() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      targetModule: this.targetModule,
      targetEntity: this.targetEntity,
      name: this.name,
      description: this.description,
      version: this.version,
      columnMappings: this.columnMappings,
      transformations: this.transformations,
      defaultValues: this.defaultValues,
      isPublic: this.isPublic,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
