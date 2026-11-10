/**
 * Data Import Repository Interface
 */

import { DataImportEntity } from '../entities/data-import.entity.js';
import { ImportFilterQuery, PaginatedResult } from '../../core/types/import.types.js';

export interface IDataImportRepository {
  create(entity: DataImportEntity): Promise<DataImportEntity>;
  findById(organizationId: string, id: string): Promise<DataImportEntity | null>;
  findMany(
    organizationId: string,
    query: ImportFilterQuery
  ): Promise<PaginatedResult<DataImportEntity>>;
  update(entity: DataImportEntity): Promise<DataImportEntity>;
  delete(organizationId: string, id: string): Promise<boolean>;
  count(organizationId: string, query?: Partial<ImportFilterQuery>): Promise<number>;
}
