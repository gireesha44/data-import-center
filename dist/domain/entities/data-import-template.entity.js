/**
 * Data Import Template Domain Entity
 */
export class DataImportTemplateEntity {
    id;
    organizationId;
    targetModule;
    targetEntity;
    name;
    description;
    version;
    columnMappings;
    transformations;
    defaultValues;
    isPublic;
    createdBy;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.organizationId = props.organizationId;
        this.targetModule = props.targetModule;
        this.targetEntity = props.targetEntity;
        this.name = props.name;
        this.description = props.description ?? null;
        this.version = props.version ?? 1;
        this.columnMappings = props.columnMappings ?? {};
        this.transformations = props.transformations ?? {};
        this.defaultValues = props.defaultValues ?? {};
        this.isPublic = props.isPublic ?? false;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt ?? new Date();
        this.updatedAt = props.updatedAt ?? new Date();
    }
    toJSON() {
        return {
            id: this.id,
            organizationId: this.organizationId,
            targetModule: this.targetModule,
            targetEntity: this.targetEntity,
            name: this.name,
            description: this.description,
            version: this.version,
            columnMappings: this.columnMappings,
            transformations: this.transformations,
            defaultValues: this.defaultValues,
            isPublic: this.isPublic,
            createdBy: this.createdBy,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };
    }
}
//# sourceMappingURL=data-import-template.entity.js.map