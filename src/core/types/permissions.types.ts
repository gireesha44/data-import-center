/**
 * Centralized RBAC Permissions and Security Context for Data Import Centre
 */

export enum DataImportPermission {
  DATA_IMPORT_VIEW = 'data_import:view',
  DATA_IMPORT_CREATE = 'data_import:create',
  DATA_IMPORT_UPLOAD = 'data_import:upload',
  DATA_IMPORT_VALIDATE = 'data_import:validate',
  DATA_IMPORT_MAP = 'data_import:map',
  DATA_IMPORT_EXECUTE = 'data_import:execute',
  DATA_IMPORT_APPROVE = 'data_import:approve',
  DATA_IMPORT_CANCEL = 'data_import:cancel',
  DATA_IMPORT_RETRY = 'data_import:retry',
  DATA_IMPORT_VIEW_SENSITIVE = 'data_import:view_sensitive',
  DATA_IMPORT_MANAGE_SOURCES = 'data_import:manage_sources',
  DATA_IMPORT_MANAGE_TEMPLATES = 'data_import:manage_templates',
  DATA_IMPORT_VIEW_AUDIT = 'data_import:view_audit'
}

export interface SecurityContext {
  userId: string;
  organizationId: string;
  roles: string[];
  permissions: DataImportPermission[];
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Checks if the given security context possesses the required permission.
 */
export function hasPermission(
  context: SecurityContext,
  requiredPermission: DataImportPermission
): boolean {
  if (!context || !Array.isArray(context.permissions)) {
    return false;
  }
  return context.permissions.includes(requiredPermission);
}

/**
 * Checks if the security context has all required permissions.
 */
export function hasAllPermissions(
  context: SecurityContext,
  requiredPermissions: DataImportPermission[]
): boolean {
  return requiredPermissions.every((p) => hasPermission(context, p));
}

/**
 * Checks if the security context has at least one of the provided permissions.
 */
export function hasAnyPermission(
  context: SecurityContext,
  permissions: DataImportPermission[]
): boolean {
  return permissions.some((p) => hasPermission(context, p));
}
