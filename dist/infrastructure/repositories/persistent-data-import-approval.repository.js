/**
 * Persistent Data Import Approval Repository Implementation
 */
import { DataImportApprovalEntity } from '../../domain/entities/data-import-approval.entity.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';
const TABLE_NAME = 'data_import_approvals';
export class PersistentDataImportApprovalRepository {
    async loadAll() {
        const rawRows = await persistentDatabaseEngine.loadTable(TABLE_NAME);
        return rawRows.map((r) => new DataImportApprovalEntity(r));
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
        const found = entities.find((a) => a.id === id && a.organizationId === organizationId);
        return found ?? null;
    }
    async findByImportId(organizationId, importId) {
        const list = await this.listByImportId(organizationId, importId);
        return list.length > 0 ? list[list.length - 1] : null;
    }
    async listByImportId(organizationId, importId) {
        const entities = await this.loadAll();
        return entities.filter((a) => a.importId === importId && a.organizationId === organizationId);
    }
    async update(entity) {
        const entities = await this.loadAll();
        const idx = entities.findIndex((a) => a.id === entity.id && a.organizationId === entity.organizationId);
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
//# sourceMappingURL=persistent-data-import-approval.repository.js.map