/**
 * Persistent Data Import Execution Repository Implementation
 */
import { DataImportExecutionEntity } from '../../domain/entities/data-import-execution.entity.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';
const TABLE_NAME = 'data_import_executions';
export class PersistentDataImportExecutionRepository {
    async loadAll() {
        const rawRows = await persistentDatabaseEngine.loadTable(TABLE_NAME);
        return rawRows.map((r) => new DataImportExecutionEntity(r));
    }
    async saveAll(entities) {
        await persistentDatabaseEngine.saveTable(TABLE_NAME, entities);
    }
    async create(entity) {
        const entities = await this.loadAll();
        entities.push(entity);
        await this.saveAll(entities);
        return entity;
    }
    async findById(organizationId, id) {
        const entities = await this.loadAll();
        const found = entities.find((e) => e.id === id && e.organizationId === organizationId);
        return found ?? null;
    }
    async findByImportId(organizationId, importId) {
        const list = await this.listByImportId(organizationId, importId);
        return list.length > 0 ? list[list.length - 1] : null;
    }
    async listByImportId(organizationId, importId) {
        const entities = await this.loadAll();
        return entities.filter((e) => e.importId === importId && e.organizationId === organizationId);
    }
    async update(entity) {
        const entities = await this.loadAll();
        const idx = entities.findIndex((e) => e.id === entity.id && e.organizationId === entity.organizationId);
        if (idx !== -1) {
            entities[idx] = entity;
            await this.saveAll(entities);
        }
        return entity;
    }
    async clear() {
        await persistentDatabaseEngine.clearTable(TABLE_NAME);
    }
}
//# sourceMappingURL=persistent-data-import-execution.repository.js.map