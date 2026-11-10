/**
 * In-Memory Implementation of Data Import Reconciliation Repository
 */
export class InMemoryDataImportReconciliationRepository {
    reconciliations = new Map();
    getKey(organizationId, id) {
        return `${organizationId}:${id}`;
    }
    async create(reconciliation) {
        const key = this.getKey(reconciliation.organizationId, reconciliation.id);
        this.reconciliations.set(key, reconciliation);
        return reconciliation;
    }
    async findById(organizationId, id) {
        const key = this.getKey(organizationId, id);
        const rec = this.reconciliations.get(key);
        return rec || null;
    }
    async findByImportId(organizationId, importId) {
        const list = await this.listByImportId(organizationId, importId);
        return list.length > 0 ? list[list.length - 1] : null;
    }
    async findByExecutionId(organizationId, executionId) {
        for (const rec of this.reconciliations.values()) {
            if (rec.organizationId === organizationId && rec.executionId === executionId) {
                return rec;
            }
        }
        return null;
    }
    async listByImportId(organizationId, importId) {
        const results = [];
        for (const rec of this.reconciliations.values()) {
            if (rec.organizationId === organizationId && rec.importId === importId) {
                results.push(rec);
            }
        }
        return results.sort((a, b) => a.reconciledAt.getTime() - b.reconciledAt.getTime());
    }
    async clear() {
        this.reconciliations.clear();
    }
}
//# sourceMappingURL=in-memory-data-import-reconciliation.repository.js.map