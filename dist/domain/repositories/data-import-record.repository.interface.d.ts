/**
 * Staged Import Record Repository Interface
 */
import { DataImportRecordEntity } from '../entities/data-import-record.entity.js';
import { RecordStatus, PaginatedResult } from '../../core/types/import.types.js';
import { MatchClassification, ExecutionIntentAction } from '../../core/types/duplicate.types.js';
export interface RecordFilterOptions {
    page?: number;
    limit?: number;
    status?: RecordStatus;
    statuses?: RecordStatus[];
    classification?: MatchClassification;
    executionAction?: ExecutionIntentAction;
    isDuplicate?: boolean;
    isBlocked?: boolean;
    errorCode?: string;
    column?: string;
    search?: string;
    requiresAction?: boolean;
}
export interface IDataImportRecordRepository {
    saveBatch(records: DataImportRecordEntity[]): Promise<void>;
    findByImportId(organizationId: string, importId: string, options?: RecordFilterOptions): Promise<PaginatedResult<DataImportRecordEntity>>;
    findById(organizationId: string, id: string): Promise<DataImportRecordEntity | null>;
    countByStatus(organizationId: string, importId: string): Promise<Record<string, number>>;
    deleteByImportId(organizationId: string, importId: string): Promise<void>;
    clear(): void;
}
//# sourceMappingURL=data-import-record.repository.interface.d.ts.map