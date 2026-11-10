/**
 * In-Memory Data Import Approval Repository Implementation
 */
import { IDataImportApprovalRepository } from '../../domain/repositories/data-import-approval.repository.interface.js';
import { DataImportApprovalEntity } from '../../domain/entities/data-import-approval.entity.js';
export declare class InMemoryDataImportApprovalRepository implements IDataImportApprovalRepository {
    private approvals;
    create(entity: DataImportApprovalEntity): Promise<DataImportApprovalEntity>;
    findById(organizationId: string, id: string): Promise<DataImportApprovalEntity | null>;
    findByImportId(organizationId: string, importId: string): Promise<DataImportApprovalEntity | null>;
    listByImportId(organizationId: string, importId: string): Promise<DataImportApprovalEntity[]>;
    update(entity: DataImportApprovalEntity): Promise<DataImportApprovalEntity>;
    clear(): void;
}
export declare const inMemoryDataImportApprovalRepository: InMemoryDataImportApprovalRepository;
//# sourceMappingURL=in-memory-data-import-approval.repository.d.ts.map