/**
 * Persistent Target Match Provider Implementation
 * Stores module entity records (employees, products, invoices, vendors, etc.) in persistent storage.
 */

import { randomUUID } from 'node:crypto';
import {
  ITargetMatchProvider,
  TargetRecordMatch,
  ITargetMatchProviderRegistry
} from '../../domain/duplicate/target-match-provider.interface.js';
import { entitySchemaRegistry, EntitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { MatchKeyGenerator } from '../../domain/duplicate/match-key.generator.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';

const TABLE_NAME = 'target_module_records';

interface TargetRecordStorageItem {
  id: string;
  organizationId: string;
  entity: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export class PersistentTargetMatchProvider implements ITargetMatchProvider {
  public readonly entity: string;
  private schemaRegistry: EntitySchemaRegistry;

  constructor(entity: string, schemaRegistry: EntitySchemaRegistry = entitySchemaRegistry) {
    this.entity = entity.toLowerCase();
    this.schemaRegistry = schemaRegistry;
  }

  private async loadAll(): Promise<TargetRecordStorageItem[]> {
    const raw = await persistentDatabaseEngine.loadTable<TargetRecordStorageItem>(TABLE_NAME);
    return raw.filter((r) => r.entity.toLowerCase() === this.entity);
  }

  private async saveAllForEntity(items: TargetRecordStorageItem[]): Promise<void> {
    const all = await persistentDatabaseEngine.loadTable<TargetRecordStorageItem>(TABLE_NAME);
    const otherEntities = all.filter((r) => r.entity.toLowerCase() !== this.entity);
    await persistentDatabaseEngine.saveTable(TABLE_NAME, [...otherEntities, ...items]);
  }

  /**
   * Seed target records for a specific tenant organization
   */
  public async seedRecords(
    organizationId: string,
    records: Array<Record<string, unknown> & { id: string }>
  ): Promise<void> {
    const current = await this.loadAll();
    const otherOrgs = current.filter((r) => r.organizationId !== organizationId);

    const now = new Date().toISOString();
    const newItems: TargetRecordStorageItem[] = records.map((rec) => ({
      id: rec.id,
      organizationId,
      entity: this.entity,
      data: { ...rec },
      createdAt: (rec.createdAt as string) || now,
      updatedAt: (rec.updatedAt as string) || now
    }));

    await this.saveAllForEntity([...otherOrgs, ...newItems]);
  }

  /**
   * Batch lookup target records by match key hashes for a given organization
   */
  public async findByMatchKeys(
    organizationId: string,
    matchKeyHashes: string[],
    _matchKeys: string[]
  ): Promise<Map<string, TargetRecordMatch[]>> {
    const resultMap = new Map<string, TargetRecordMatch[]>();
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
  public async getRecord(
    organizationId: string,
    recordId: string
  ): Promise<Record<string, unknown> | null> {
    const current = await this.loadAll();
    const found = current.find((r) => r.organizationId === organizationId && r.id === recordId);
    return found ? { ...found.data } : null;
  }

  /**
   * Create target entity record
   */
  public async createRecord(
    organizationId: string,
    data: Record<string, unknown>
  ): Promise<{ id: string; record: Record<string, unknown> }> {
    const current = await this.loadAll();
    const id = (data.id as string) || `target_${this.entity}_${randomUUID()}`;
    const now = new Date().toISOString();
    const recordData = { ...data, id, createdAt: now, updatedAt: now };

    const newItem: TargetRecordStorageItem = {
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
  public async updateRecord(
    organizationId: string,
    recordId: string,
    data: Record<string, unknown>
  ): Promise<{ id: string; record: Record<string, unknown> }> {
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
  public async deleteRecord(organizationId: string, recordId: string): Promise<boolean> {
    const current = await this.loadAll();
    const filtered = current.filter((r) => !(r.organizationId === organizationId && r.id === recordId));
    if (filtered.length === current.length) return false;

    await this.saveAllForEntity(filtered);
    return true;
  }

  public async clear(organizationId?: string): Promise<void> {
    if (organizationId) {
      const current = await this.loadAll();
      const remaining = current.filter((r) => r.organizationId !== organizationId);
      await this.saveAllForEntity(remaining);
    } else {
      await persistentDatabaseEngine.clearTable(TABLE_NAME);
    }
  }
}

export class PersistentTargetMatchProviderRegistry implements ITargetMatchProviderRegistry {
  private providers: Map<string, ITargetMatchProvider> = new Map();

  public getProvider(entity: string): ITargetMatchProvider {
    const normalized = entity.toLowerCase();
    if (!this.providers.has(normalized)) {
      this.providers.set(normalized, new PersistentTargetMatchProvider(normalized));
    }
    return this.providers.get(normalized)!;
  }

  public hasProvider(entityName: string): boolean {
    return true;
  }

  public registerProvider(provider: ITargetMatchProvider): void {
    this.providers.set(provider.entity.toLowerCase(), provider);
  }

  public clear(organizationId?: string): void {
    for (const provider of this.providers.values()) {
      if ('clear' in provider && typeof (provider as any).clear === 'function') {
        (provider as any).clear(organizationId);
      }
    }
  }
}

export const persistentTargetMatchProviderRegistry = new PersistentTargetMatchProviderRegistry();
