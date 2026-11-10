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

export class DataImportSourceEntity {
  public readonly id: string;
  public readonly organizationId: string;
  public name: string;
  public sourceType: ImportSourceType;
  public fileFormat: ImportFileFormat | null;
  public connectionConfig: Record<string, unknown>;
  public isActive: boolean;
  public readonly createdBy: string;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: DataImportSourceProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.sourceType = props.sourceType;
    this.fileFormat = props.fileFormat ?? null;
    this.connectionConfig = props.connectionConfig ?? {};
    this.isActive = props.isActive ?? true;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  public toJSON() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      name: this.name,
      sourceType: this.sourceType,
      fileFormat: this.fileFormat,
      isActive: this.isActive,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
