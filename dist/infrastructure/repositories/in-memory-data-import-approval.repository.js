/**
 * In-Memory Data Import Approval Repository Implementation
 */
export class InMemoryDataImportApprovalRepository {
    approvals = new Map();
    async create(entity) {
        const key = `${entity.organizationId}:${entity.id}`;
        this.approvals.set(key, entity);
        return entity;
    }
    async findById(organizationId, id) {
        const key = `${organizationId}:${id}`;
        return this.approvals.get(key) || null;
    }
    async findByImportId(organizationId, importId) {
        const list = await this.listByImportId(organizationId, importId);
        return list.length > 0 ? list[list.length - 1] : null;
    }
    async listByImportId(organizationId, importId) {
        return Array.from(this.approvals.values())
            .filter((a) => a.organizationId === organizationId && a.importId === importId)
            .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
    }
    async update(entity) {
        const key = `${entity.organizationId}:${entity.id}`;
        this.approvals.set(key, entity);
        return entity;
    }
    clear() {
        this.approvals.clear();
    }
}
export const inMemoryDataImportApprovalRepository = new InMemoryDataImportApprovalRepository();
//# sourceMappingURL=in-memory-data-import-approval.repository.js.map