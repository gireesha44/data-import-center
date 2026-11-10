/**
 * Data Import Mapping Domain Entity
 */
export class DataImportMappingEntity {
    id;
    organizationId;
    importId;
    sourceColumns;
    columnMappings;
    transformations;
    defaultValues;
    unmappedBehavior;
    isValid;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.organizationId = props.organizationId;
        this.importId = props.importId;
        this.sourceColumns = props.sourceColumns ?? [];
        this.columnMappings = props.columnMappings ?? {};
        this.transformations = props.transformations ?? {};
        this.defaultValues = props.defaultValues ?? {};
        this.unmappedBehavior = props.unmappedBehavior ?? 'IGNORE';
        this.isValid = props.isValid ?? false;
        this.createdAt = props.createdAt ? (props.createdAt instanceof Date ? props.createdAt : new Date(props.createdAt)) : new Date();
        this.updatedAt = props.updatedAt ? (props.updatedAt instanceof Date ? props.updatedAt : new Date(props.updatedAt)) : new Date();
    }
    toJSON() {
        return {
            id: this.id,
            organizationId: this.organizationId,
            importId: this.importId,
            sourceColumns: this.sourceColumns,
            columnMappings: this.columnMappings,
            transformations: this.transformations,
            defaultValues: this.defaultValues,
            unmappedBehavior: this.unmappedBehavior,
            isValid: this.isValid,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };
    }
}
//# sourceMappingURL=data-import-mapping.entity.js.map