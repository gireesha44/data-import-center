/**
 * Data Import Source Domain Entity
 */
export class DataImportSourceEntity {
    id;
    organizationId;
    name;
    sourceType;
    fileFormat;
    connectionConfig;
    isActive;
    createdBy;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.organizationId = props.organizationId;
        this.name = props.name;
        this.sourceType = props.sourceType;
        this.fileFormat = props.fileFormat ?? null;
        this.connectionConfig = props.connectionConfig ?? {};
        this.isActive = props.isActive ?? true;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt ?? new Date();
        this.updatedAt = props.updatedAt ?? new Date();
    }
    toJSON() {
        return {
            id: this.id,
            organizationId: this.organizationId,
            name: this.name,
            sourceType: this.sourceType,
            fileFormat: this.fileFormat,
            isActive: this.isActive,
            createdBy: this.createdBy,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };
    }
}
//# sourceMappingURL=data-import-source.entity.js.map