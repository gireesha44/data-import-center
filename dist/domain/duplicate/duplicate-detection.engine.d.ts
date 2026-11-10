/**
 * Pure Deterministic Duplicate Detection & Record Matching Engine
 */
import { RecordMatchResult, ExecutionIntent, DuplicateSummary, ITargetMatchProvider } from '../../core/types/duplicate.types.js';
import { DuplicateStrategy, ImportMode } from '../../core/types/import.types.js';
import { DataImportRecordEntity } from '../entities/data-import-record.entity.js';
import { EntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
export interface DuplicateDetectionOptions {
    organizationId: string;
    entityName: string;
    duplicateStrategy: DuplicateStrategy;
    importMode?: ImportMode;
    targetProvider?: ITargetMatchProvider;
    schemaRegistry?: EntitySchemaRegistry;
}
export interface DuplicateDetectionEngineResult {
    matchResults: Map<string, RecordMatchResult>;
    intents: Map<string, ExecutionIntent>;
    summary: DuplicateSummary;
}
export declare class DuplicateDetectionEngine {
    /**
     * Executes duplicate detection, intra-file grouping, target matching, and execution intent calculation
     */
    static evaluateDataset(records: DataImportRecordEntity[], options: DuplicateDetectionOptions): Promise<DuplicateDetectionEngineResult>;
}
//# sourceMappingURL=duplicate-detection.engine.d.ts.map