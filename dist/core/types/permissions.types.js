/**
 * Centralized RBAC Permissions and Security Context for Data Import Centre
 */
export var DataImportPermission;
(function (DataImportPermission) {
    DataImportPermission["DATA_IMPORT_VIEW"] = "data_import:view";
    DataImportPermission["DATA_IMPORT_CREATE"] = "data_import:create";
    DataImportPermission["DATA_IMPORT_UPLOAD"] = "data_import:upload";
    DataImportPermission["DATA_IMPORT_VALIDATE"] = "data_import:validate";
    DataImportPermission["DATA_IMPORT_MAP"] = "data_import:map";
    DataImportPermission["DATA_IMPORT_EXECUTE"] = "data_import:execute";
    DataImportPermission["DATA_IMPORT_APPROVE"] = "data_import:approve";
    DataImportPermission["DATA_IMPORT_CANCEL"] = "data_import:cancel";
    DataImportPermission["DATA_IMPORT_RETRY"] = "data_import:retry";
    DataImportPermission["DATA_IMPORT_VIEW_SENSITIVE"] = "data_import:view_sensitive";
    DataImportPermission["DATA_IMPORT_MANAGE_SOURCES"] = "data_import:manage_sources";
    DataImportPermission["DATA_IMPORT_MANAGE_TEMPLATES"] = "data_import:manage_templates";
    DataImportPermission["DATA_IMPORT_VIEW_AUDIT"] = "data_import:view_audit";
})(DataImportPermission || (DataImportPermission = {}));
/**
 * Checks if the given security context possesses the required permission.
 */
export function hasPermission(context, requiredPermission) {
    if (!context || !Array.isArray(context.permissions)) {
        return false;
    }
    return context.permissions.includes(requiredPermission);
}
/**
 * Checks if the security context has all required permissions.
 */
export function hasAllPermissions(context, requiredPermissions) {
    return requiredPermissions.every((p) => hasPermission(context, p));
}
/**
 * Checks if the security context has at least one of the provided permissions.
 */
export function hasAnyPermission(context, permissions) {
    return permissions.some((p) => hasPermission(context, p));
}
//# sourceMappingURL=permissions.types.js.map