/**
 * Data Import Mapping Repository Interface
 */

import { DataImportMappingEntity } from '../entities/data-import-mapping.entity.js';

export interface IDataImportMappingRepository {
  save(mapping: DataImportMappingEntity): Promise<DataImportMappingEntity>;
  findByImportId(organizationId: string, importId: string): Promise<DataImportMappingEntity | null>;
  deleteByImportId(organizationId: string, importId: string): Promise<boolean>;
  clear(): void;
}
