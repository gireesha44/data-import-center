/**
 * Persistent Data Import Reconciliation Repository Implementation
 */
import { DataImportReconciliationEntity } from '../../domain/entities/data-import-reconciliation.entity.js';
import { persistentDatabaseEngine } from '../database/persistent-database.engine.js';
const TABLE_NAME = 'data_import_reconciliations';
export class PersistentDataImportReconciliationRepository {
    async loadAll() {
        const rawRows = await persistentDatabaseEngine.loadTable(TABLE_NAME);
        return rawRows.map((r) => new DataImportReconciliationEntity(r));
    }
    async saveAll(entities) {
        await persistentDatabaseEngine.saveTable(TABLE_NAME, entities);
    }
    async create(reconciliation) {
        const entities = await this.loadAll();
        entities.push(reconciliation);
        await this.saveAll(entities);
        return reconciliation;
    }
    async findById(organizationId, id) {
        const entities = await this.loadAll();
        const found = entities.find((r) => r.id === id && r.organizationId === organizationId);
        return found ?? null;
    }
    async findByImportId(organizationId, importId) {
        const list = await this.listByImportId(organizationId, importId);
        return list.length > 0 ? list[list.length - 1] : null;
    }
    async findByExecutionId(organizationId, executionId) {
        const entities = await this.loadAll();
        const found = entities.find((r) => r.executionId === executionId && r.organizationId === organizationId);
        return found ?? null;
    }
    async listByImportId(organizationId, importId) {
        const entities = await this.loadAll();
        return entities.filter((r) => r.importId === importId && r.organizationId === organizationId);
    }
    async clear() {
        await persistentDatabaseEngine.clearTable(TABLE_NAME);
    }
}
//# sourceMappingURL=persistent-data-import-reconciliation.repository.js.map