/**
 * Data Import Execution Repository Interface
 */

import { DataImportExecutionEntity } from '../entities/data-import-execution.entity.js';

export interface IDataImportExecutionRepository {
  create(entity: DataImportExecutionEntity): Promise<DataImportExecutionEntity>;
  findById(organizationId: string, id: string): Promise<DataImportExecutionEntity | null>;
  findByImportId(
    organizationId: string,
    importId: string
  ): Promise<DataImportExecutionEntity | null>;
  listByImportId(
    organizationId: string,
    importId: string
  ): Promise<DataImportExecutionEntity[]>;
  update(entity: DataImportExecutionEntity): Promise<DataImportExecutionEntity>;
  clear(): void;
}
