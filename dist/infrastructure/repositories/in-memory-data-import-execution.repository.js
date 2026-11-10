/**
 * In-Memory Data Import Execution Repository Implementation
 */
export class InMemoryDataImportExecutionRepository {
    executions = new Map();
    async create(entity) {
        const key = `${entity.organizationId}:${entity.id}`;
        this.executions.set(key, entity);
        return entity;
    }
    async findById(organizationId, id) {
        const key = `${organizationId}:${id}`;
        return this.executions.get(key) || null;
    }
    async findByImportId(organizationId, importId) {
        const list = await this.listByImportId(organizationId, importId);
        return list.length > 0 ? list[list.length - 1] : null;
    }
    async listByImportId(organizationId, importId) {
        return Array.from(this.executions.values())
            .filter((e) => e.organizationId === organizationId && e.importId === importId)
            .sort((a, b) => (a.startedAt?.getTime() || 0) - (b.startedAt?.getTime() || 0));
    }
    async update(entity) {
        const key = `${entity.organizationId}:${entity.id}`;
        this.executions.set(key, entity);
        return entity;
    }
    clear() {
        this.executions.clear();
    }
}
export const inMemoryDataImportExecutionRepository = new InMemoryDataImportExecutionRepository();
//# sourceMappingURL=in-memory-data-import-execution.repository.js.map