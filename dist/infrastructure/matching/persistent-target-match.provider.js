/**
 * Persistent Target Match Provider Implementation
 * Stores module entity records (employees, products, invoices, vendors, etc.) in persistent storage.
 */
import { randomUUID } from 'node:crypto';
import { entitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { MatchKeyGenerator } from '../../domain/duplicate/match-key.generator.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';
const TABLE_NAME = 'target_module_records';
export class PersistentTargetMatchProvider {
    entity;
    schemaRegistry;
    constructor(entity, schemaRegistry = entitySchemaRegistry) {
        this.entity = entity.toLowerCase();
        this.schemaRegistry = schemaRegistry;
    }
    async loadAll() {
        const raw = await persistentDatabaseEngine.loadTable(TABLE_NAME);
        return raw.filter((r) => r.entity.toLowerCase() === this.entity);
    }
    async saveAllForEntity(items) {
        const all = await persistentDatabaseEngine.loadTable(TABLE_NAME);
        const otherEntities = all.filter((r) => r.entity.toLowerCase() !== this.entity);
        await persistentDatabaseEngine.saveTable(TABLE_NAME, [...otherEntities, ...items]);
    }
    /**
     * Seed target records for a specific tenant organization
     */
    async seedRecords(organizationId, records) {
        const current = await this.loadAll();
        const otherOrgs = current.filter((r) => r.organizationId !== organizationId);
        const now = new Date().toISOString();
        const newItems = records.map((rec) => ({
            id: rec.id,
            organizationId,
            entity: this.entity,
            data: { ...rec },
            createdAt: rec.createdAt || now,
            updatedAt: rec.updatedAt || now
        }));
        await this.saveAllForEntity([...otherOrgs, ...newItems]);
    }
    /**
     * Batch lookup target records by match key hashes for a given organization
     */
    async findByMatchKeys(organizationId, matchKeyHashes, _matchKeys) {
        const resultMap = new Map();
        const hashSet = new Set(matchKeyHashes);
        const current = await this.loadAll();
        const orgRecords = current.filter((r) => r.organizationId === organizationId);
        if (orgRecords.length === 0 || hashSet.size === 0) {
            return resultMap;
        }
        const schema = this.schemaRegistry.getEntity(this.entity);
        const duplicateRule = schema?.duplicateRules?.find((r) => r.isDefault) || schema?.duplicateRules?.[0];
        if (!duplicateRule) {
            return resultMap;
        }
        for (const item of orgRecords) {
            const generated = MatchKeyGenerator.generateMatchKey(item.data, duplicateRule, schema?.fields);
            if (generated && hashSet.has(generated.hash)) {
                const matches = resultMap.get(generated.hash) || [];
                matches.push({
                    id: item.id,
                    matchKey: generated.displayKey,
                    matchKeyHash: generated.hash,
                    data: item.data
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
        const current = await this.loadAll();
        const found = current.find((r) => r.organizationId === organizationId && r.id === recordId);
        return found ? { ...found.data } : null;
    }
    /**
     * Create target entity record
     */
    async createRecord(organizationId, data) {
        const current = await this.loadAll();
        const id = data.id || `target_${this.entity}_${randomUUID()}`;
        const now = new Date().toISOString();
        const recordData = { ...data, id, createdAt: now, updatedAt: now };
        const newItem = {
            id,
            organizationId,
            entity: this.entity,
            data: recordData,
            createdAt: now,
            updatedAt: now
        };
        current.push(newItem);
        await this.saveAllForEntity(current);
        return { id, record: recordData };
    }
    /**
     * Update target entity record
     */
    async updateRecord(organizationId, recordId, data) {
        const current = await this.loadAll();
        const idx = current.findIndex((r) => r.organizationId === organizationId && r.id === recordId);
        if (idx === -1) {
            throw new Error(`Target record with ID '${recordId}' not found for update`);
        }
        const now = new Date().toISOString();
        const existingData = current[idx].data;
        const updatedData = {
            ...existingData,
            ...data,
            id: recordId,
            updatedAt: now
        };
        current[idx] = {
            ...current[idx],
            data: updatedData,
            updatedAt: now
        };
        await this.saveAllForEntity(current);
        return { id: recordId, record: updatedData };
    }
    /**
     * Delete target entity record
     */
    async deleteRecord(organizationId, recordId) {
        const current = await this.loadAll();
        const filtered = current.filter((r) => !(r.organizationId === organizationId && r.id === recordId));
        if (filtered.length === current.length)
            return false;
        await this.saveAllForEntity(filtered);
        return true;
    }
    async clear(organizationId) {
        if (organizationId) {
            const current = await this.loadAll();
            const remaining = current.filter((r) => r.organizationId !== organizationId);
            await this.saveAllForEntity(remaining);
        }
        else {
            await persistentDatabaseEngine.clearTable(TABLE_NAME);
        }
    }
}
export class PersistentTargetMatchProviderRegistry {
    providers = new Map();
    getProvider(entity) {
        const normalized = entity.toLowerCase();
        if (!this.providers.has(normalized)) {
            this.providers.set(normalized, new PersistentTargetMatchProvider(normalized));
        }
        return this.providers.get(normalized);
    }
    hasProvider(entityName) {
        return true;
    }
    registerProvider(provider) {
        this.providers.set(provider.entity.toLowerCase(), provider);
    }
    clear(organizationId) {
        for (const provider of this.providers.values()) {
            if ('clear' in provider && typeof provider.clear === 'function') {
                provider.clear(organizationId);
            }
        }
    }
}
export const persistentTargetMatchProviderRegistry = new PersistentTargetMatchProviderRegistry();
//# sourceMappingURL=persistent-target-match.provider.js.map