/**
 * Data Import Approval Repository Interface
 */

import { DataImportApprovalEntity } from '../entities/data-import-approval.entity.js';

export interface IDataImportApprovalRepository {
  create(entity: DataImportApprovalEntity): Promise<DataImportApprovalEntity>;
  findById(organizationId: string, id: string): Promise<DataImportApprovalEntity | null>;
  findByImportId(
    organizationId: string,
    importId: string
  ): Promise<DataImportApprovalEntity | null>;
  listByImportId(
    organizationId: string,
    importId: string
  ): Promise<DataImportApprovalEntity[]>;
  update(entity: DataImportApprovalEntity): Promise<DataImportApprovalEntity>;
  clear(): void;
}
