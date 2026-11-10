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

export class DataImportMappingEntity {
  public readonly id: string;
  public readonly organizationId: string;
  public readonly importId: string;
  public sourceColumns: SourceColumnInfo[];
  public columnMappings: Record<string, ColumnMappingDefinition>;
  public transformations: Record<string, unknown[]>;
  public defaultValues: Record<string, unknown>;
  public unmappedBehavior: 'IGNORE' | 'SET_NULL';
  public isValid: boolean;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: DataImportMappingProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.importId = props.importId;
    this.sourceColumns = props.sourceColumns ?? [];
    this.columnMappings = props.columnMappings ?? {};
    this.transformations = props.transformations ?? {};
    this.defaultValues = props.defaultValues ?? {};
    this.unmappedBehavior = props.unmappedBehavior ?? 'IGNORE';
    this.isValid = props.isValid ?? false;
    this.createdAt = props.createdAt ? (props.createdAt instanceof Date ? props.createdAt : new Date(props.createdAt)) : new Date();
    this.updatedAt = props.updatedAt ? (props.updatedAt instanceof Date ? props.updatedAt : new Date(props.updatedAt)) : new Date();
  }

  public toJSON() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      importId: this.importId,
      sourceColumns: this.sourceColumns,
      columnMappings: this.columnMappings,
      transformations: this.transformations,
      defaultValues: this.defaultValues,
      unmappedBehavior: this.unmappedBehavior,
      isValid: this.isValid,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
