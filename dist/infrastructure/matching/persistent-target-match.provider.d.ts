/**
 * Persistent Target Match Provider Implementation
 * Stores module entity records (employees, products, invoices, vendors, etc.) in persistent storage.
 */
import { ITargetMatchProvider, TargetRecordMatch, ITargetMatchProviderRegistry } from '../../domain/duplicate/target-match-provider.interface.js';
import { EntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
export declare class PersistentTargetMatchProvider implements ITargetMatchProvider {
    readonly entity: string;
    private schemaRegistry;
    constructor(entity: string, schemaRegistry?: EntitySchemaRegistry);
    private loadAll;
    private saveAllForEntity;
    /**
     * Seed target records for a specific tenant organization
     */
    seedRecords(organizationId: string, records: Array<Record<string, unknown> & {
        id: string;
    }>): Promise<void>;
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
    clear(organizationId?: string): Promise<void>;
}
export declare class PersistentTargetMatchProviderRegistry implements ITargetMatchProviderRegistry {
    private providers;
    getProvider(entity: string): ITargetMatchProvider;
    hasProvider(entityName: string): boolean;
    registerProvider(provider: ITargetMatchProvider): void;
    clear(organizationId?: string): void;
}
export declare const persistentTargetMatchProviderRegistry: PersistentTargetMatchProviderRegistry;
//# sourceMappingURL=persistent-target-match.provider.d.ts.map