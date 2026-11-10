/**
 * In-Memory Data Import Mapping Repository Implementation
 */
export class InMemoryDataImportMappingRepository {
    mappingsByImportId = new Map();
    async save(mapping) {
        const key = `${mapping.organizationId}:${mapping.importId}`;
        mapping.updatedAt = new Date();
        this.mappingsByImportId.set(key, mapping);
        return mapping;
    }
    async findByImportId(organizationId, importId) {
        const key = `${organizationId}:${importId}`;
        return this.mappingsByImportId.get(key) || null;
    }
    async deleteByImportId(organizationId, importId) {
        const key = `${organizationId}:${importId}`;
        return this.mappingsByImportId.delete(key);
    }
    clear() {
        this.mappingsByImportId.clear();
    }
}
//# sourceMappingURL=in-memory-data-import-mapping.repository.js.map