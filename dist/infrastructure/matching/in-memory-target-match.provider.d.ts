/**
 * In-Memory Target Match Provider and Registry Implementation
 */
import { ITargetMatchProvider, TargetRecordMatch, ITargetMatchProviderRegistry } from '../../domain/duplicate/target-match-provider.interface.js';
import { EntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
export declare class InMemoryTargetMatchProvider implements ITargetMatchProvider {
    readonly entity: string;
    private schemaRegistry;
    private targetRecordsByOrg;
    constructor(entity: string, schemaRegistry?: EntitySchemaRegistry);
    /**
     * Seed target records for a specific tenant organization
     */
    seedRecords(organizationId: string, records: Array<Record<string, unknown> & {
        id: string;
    }>): void;
    /**
     * Batch lookup target records by match key hashes for a given organization
     */
    findByMatchKeys(organizationId: string, matchKeyHashes: string[], _matchKeys: string[]): Promise<Map<string, TargetRecordMatch[]>>;
    /**
     * Fetch single target record by ID within organization scope
     */
    getRecord(organizationId: string, recordId: string): Promise<Record<string, unknown> | null>;
    /**
     * Create target entity record
     */
    createRecord(organizationId: string, data: Record<string, unknown>): Promise<{
        id: string;
        record: Record<string, unknown>;
    }>;
    /**
     * Update target entity record
     */
    updateRecord(organizationId: string, recordId: string, data: Record<string, unknown>): Promise<{
        id: string;
        record: Record<string, unknown>;
    }>;
    /**
     * Delete target entity record
     */
    deleteRecord(organizationId: string, recordId: string): Promise<boolean>;
    clear(organizationId?: string): void;
}
export declare class TargetMatchProviderRegistry implements ITargetMatchProviderRegistry {
    private providers;
    constructor();
    registerProvider(provider: ITargetMatchProvider): void;
    getProvider(entityName: string): ITargetMatchProvider | undefined;
    hasProvider(entityName: string): boolean;
    clear(): void;
}
export declare const targetMatchProviderRegistry: TargetMatchProviderRegistry;
//# sourceMappingURL=in-memory-target-match.provider.d.ts.map