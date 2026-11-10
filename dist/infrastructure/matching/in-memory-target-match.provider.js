/**
 * In-Memory Target Match Provider and Registry Implementation
 */
import { randomUUID } from 'node:crypto';
import { entitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { MatchKeyGenerator } from '../../domain/duplicate/match-key.generator.js';
export class InMemoryTargetMatchProvider {
    entity;
    schemaRegistry;
    // organizationId -> Map<recordId, recordData>
    targetRecordsByOrg = new Map();
    constructor(entity, schemaRegistry = entitySchemaRegistry) {
        this.entity = entity.toLowerCase();
        this.schemaRegistry = schemaRegistry;
    }
    /**
     * Seed target records for a specific tenant organization
     */
    seedRecords(organizationId, records) {
        if (!this.targetRecordsByOrg.has(organizationId)) {
            this.targetRecordsByOrg.set(organizationId, new Map());
        }
        const orgMap = this.targetRecordsByOrg.get(organizationId);
        for (const record of records) {
            orgMap.set(record.id, { ...record });
        }
    }
    /**
     * Batch lookup target records by match key hashes for a given organization
     */
    async findByMatchKeys(organizationId, matchKeyHashes, _matchKeys) {
        const resultMap = new Map();
        const hashSet = new Set(matchKeyHashes);
        const orgMap = this.targetRecordsByOrg.get(organizationId);
        if (!orgMap || orgMap.size === 0 || hashSet.size === 0) {
            return resultMap;
        }
        const schema = this.schemaRegistry.getEntity(this.entity);
        const duplicateRule = schema?.duplicateRules?.find((r) => r.isDefault) || schema?.duplicateRules?.[0];
        if (!duplicateRule) {
            return resultMap;
        }
        for (const [id, record] of orgMap.entries()) {
            const generated = MatchKeyGenerator.generateMatchKey(record, duplicateRule, schema?.fields);
            if (generated && hashSet.has(generated.hash)) {
                const matches = resultMap.get(generated.hash) || [];
                matches.push({
                    id,
                    matchKey: generated.displayKey,
                    matchKeyHash: generated.hash,
                    data: record
                });
                resultMap.set(generated.hash, matches);
            }
        }
        return resultMap;
    }
    /**
     * Fetch single target record by ID within organization scope
     */
    async getRecord(organizationId, recordId) {
        const orgMap = this.targetRecordsByOrg.get(organizationId);
        if (!orgMap)
            return null;
        const record = orgMap.get(recordId);
        return record ? { ...record } : null;
    }
    /**
     * Create target entity record
     */
    async createRecord(organizationId, data) {
        if (!this.targetRecordsByOrg.has(organizationId)) {
            this.targetRecordsByOrg.set(organizationId, new Map());
        }
        const orgMap = this.targetRecordsByOrg.get(organizationId);
        const id = data.id || `target_${this.entity}_${randomUUID()}`;
        const newRecord = { ...data, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        orgMap.set(id, newRecord);
        return { id, record: newRecord };
    }
    /**
     * Update target entity record
     */
    async updateRecord(organizationId, recordId, data) {
        const orgMap = this.targetRecordsByOrg.get(organizationId);
        if (!orgMap || !orgMap.has(recordId)) {
            throw new Error(`Target record with ID '${recordId}' not found for update`);
        }
        const existing = orgMap.get(recordId);
        const updated = {
            ...existing,
            ...data,
            id: recordId,
            updatedAt: new Date().toISOString()
        };
        orgMap.set(recordId, updated);
        return { id: recordId, record: updated };
    }
    /**
     * Delete target entity record
     */
    async deleteRecord(organizationId, recordId) {
        const orgMap = this.targetRecordsByOrg.get(organizationId);
        if (!orgMap)
            return false;
        return orgMap.delete(recordId);
    }
    clear(organizationId) {
        if (organizationId) {
            this.targetRecordsByOrg.delete(organizationId);
        }
        else {
            this.targetRecordsByOrg.clear();
        }
    }
}
export class TargetMatchProviderRegistry {
    providers = new Map();
    constructor() {
        // Every importable entity in the authoritative schema registry needs a
        // target adapter. The in-memory adapter is the application's default
        // persistence implementation, so registering only four legacy entities
        // caused valid Procurement/Finance/Operations imports (for example
        // `vendors`) to fail at execution time.
        for (const schema of entitySchemaRegistry.listEntities()) {
            this.registerProvider(new InMemoryTargetMatchProvider(schema.entity, entitySchemaRegistry));
        }
    }
    registerProvider(provider) {
        this.providers.set(provider.entity.toLowerCase(), provider);
    }
    getProvider(entityName) {
        return this.providers.get(entityName.toLowerCase());
    }
    hasProvider(entityName) {
        return this.providers.has(entityName.toLowerCase());
    }
    clear() {
        this.providers.clear();
    }
}
export const targetMatchProviderRegistry = new TargetMatchProviderRegistry();
//# sourceMappingURL=in-memory-target-match.provider.js.map