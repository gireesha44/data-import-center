/**
 * Persistent Data Import Mapping Repository Implementation
 */
import { DataImportMappingEntity } from '../../domain/entities/data-import-mapping.entity.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';
const TABLE_NAME = 'data_import_mappings';
export class PersistentDataImportMappingRepository {
    async loadAll() {
        const rawRows = await persistentDatabaseEngine.loadTable(TABLE_NAME);
        return rawRows.map((r) => new DataImportMappingEntity(r));
    }
    async saveAll(entities) {
        await persistentDatabaseEngine.saveTable(TABLE_NAME, entities);
    }
    async save(mapping) {
        const entities = await this.loadAll();
        const idx = entities.findIndex((m) => m.importId === mapping.importId && m.organizationId === mapping.organizationId);
        mapping.updatedAt = new Date();
        if (idx !== -1) {
            entities[idx] = mapping;
        }
        else {
            entities.push(mapping);
        }
        await this.saveAll(entities);
        return mapping;
    }
    async findByImportId(organizationId, importId) {
        const entities = await this.loadAll();
        const item = entities.find((m) => m.importId === importId && m.organizationId === organizationId);
        return item ?? null;
    }
    async deleteByImportId(organizationId, importId) {
        let entities = await this.loadAll();
        const existing = entities.find((m) => m.importId === importId && m.organizationId === organizationId);
        if (!existing)
            return false;
        entities = entities.filter((m) => !(m.importId === importId && m.organizationId === organizationId));
        await this.saveAll(entities);
        return true;
    }
    async clear() {
        await persistentDatabaseEngine.clearTable(TABLE_NAME);
    }
}
//# sourceMappingURL=persistent-data-import-mapping.repository.js.map