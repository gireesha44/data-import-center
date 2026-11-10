/**
 * Security & RBAC Middleware for Data Import Centre
 */
import { DataImportPermission, hasPermission } from '../../core/types/permissions.types.js';
import { UnauthorizedError, ForbiddenError } from '../../core/errors/import.errors.js';
const ROLE_PERMISSIONS = {
    admin: Object.values(DataImportPermission),
    superadmin: Object.values(DataImportPermission),
    lead: [
        DataImportPermission.DATA_IMPORT_VIEW,
        DataImportPermission.DATA_IMPORT_APPROVE,
        DataImportPermission.DATA_IMPORT_VIEW_SENSITIVE,
        DataImportPermission.DATA_IMPORT_VIEW_AUDIT
    ],
    manager: [
        DataImportPermission.DATA_IMPORT_VIEW,
        DataImportPermission.DATA_IMPORT_APPROVE,
        DataImportPermission.DATA_IMPORT_VIEW_SENSITIVE,
        DataImportPermission.DATA_IMPORT_VIEW_AUDIT
    ],
    operator: [
        DataImportPermission.DATA_IMPORT_VIEW,
        DataImportPermission.DATA_IMPORT_CREATE,
        DataImportPermission.DATA_IMPORT_UPLOAD,
        DataImportPermission.DATA_IMPORT_MAP,
        DataImportPermission.DATA_IMPORT_VALIDATE,
        DataImportPermission.DATA_IMPORT_EXECUTE,
        DataImportPermission.DATA_IMPORT_CANCEL,
        DataImportPermission.DATA_IMPORT_RETRY,
        DataImportPermission.DATA_IMPORT_VIEW_SENSITIVE
    ],
    user: [
        DataImportPermission.DATA_IMPORT_VIEW,
        DataImportPermission.DATA_IMPORT_CREATE,
        DataImportPermission.DATA_IMPORT_UPLOAD,
        DataImportPermission.DATA_IMPORT_VALIDATE,
        DataImportPermission.DATA_IMPORT_CANCEL
    ],
    viewer: [DataImportPermission.DATA_IMPORT_VIEW],
    auditor: [DataImportPermission.DATA_IMPORT_VIEW, DataImportPermission.DATA_IMPORT_VIEW_AUDIT],
    // Business roles exposed by the enterprise Data Import Centre UI. These are
    // intentionally explicit rather than being silently aliased to generic
    // operator/manager roles, so the backend can enforce the eight documented
    // roles without granting unrelated authority. Department scoping is applied
    // by the module/entity authorization layer in the host integration.
    org_admin: Object.values(DataImportPermission),
    hr_admin: [
        DataImportPermission.DATA_IMPORT_VIEW, DataImportPermission.DATA_IMPORT_CREATE,
        DataImportPermission.DATA_IMPORT_UPLOAD, DataImportPermission.DATA_IMPORT_MAP,
        DataImportPermission.DATA_IMPORT_VALIDATE, DataImportPermission.DATA_IMPORT_EXECUTE,
        DataImportPermission.DATA_IMPORT_APPROVE, DataImportPermission.DATA_IMPORT_CANCEL,
        DataImportPermission.DATA_IMPORT_RETRY, DataImportPermission.DATA_IMPORT_VIEW_SENSITIVE,
        DataImportPermission.DATA_IMPORT_VIEW_AUDIT
    ],
    finance_admin: [
        DataImportPermission.DATA_IMPORT_VIEW, DataImportPermission.DATA_IMPORT_CREATE,
        DataImportPermission.DATA_IMPORT_UPLOAD, DataImportPermission.DATA_IMPORT_MAP,
        DataImportPermission.DATA_IMPORT_VALIDATE, DataImportPermission.DATA_IMPORT_EXECUTE,
        DataImportPermission.DATA_IMPORT_APPROVE, DataImportPermission.DATA_IMPORT_CANCEL,
        DataImportPermission.DATA_IMPORT_RETRY, DataImportPermission.DATA_IMPORT_VIEW_SENSITIVE,
        DataImportPermission.DATA_IMPORT_VIEW_AUDIT
    ],
    procurement_manager: [
        DataImportPermission.DATA_IMPORT_VIEW, DataImportPermission.DATA_IMPORT_CREATE,
        DataImportPermission.DATA_IMPORT_UPLOAD, DataImportPermission.DATA_IMPORT_MAP,
        DataImportPermission.DATA_IMPORT_VALIDATE, DataImportPermission.DATA_IMPORT_EXECUTE,
        DataImportPermission.DATA_IMPORT_APPROVE, DataImportPermission.DATA_IMPORT_CANCEL,
        DataImportPermission.DATA_IMPORT_RETRY, DataImportPermission.DATA_IMPORT_VIEW_SENSITIVE,
        DataImportPermission.DATA_IMPORT_VIEW_AUDIT
    ],
    sales_manager: [
        DataImportPermission.DATA_IMPORT_VIEW, DataImportPermission.DATA_IMPORT_CREATE,
        DataImportPermission.DATA_IMPORT_UPLOAD, DataImportPermission.DATA_IMPORT_MAP,
        DataImportPermission.DATA_IMPORT_VALIDATE, DataImportPermission.DATA_IMPORT_EXECUTE,
        DataImportPermission.DATA_IMPORT_APPROVE, DataImportPermission.DATA_IMPORT_CANCEL,
        DataImportPermission.DATA_IMPORT_RETRY, DataImportPermission.DATA_IMPORT_VIEW_SENSITIVE,
        DataImportPermission.DATA_IMPORT_VIEW_AUDIT
    ],
    compliance_manager: [
        DataImportPermission.DATA_IMPORT_VIEW, DataImportPermission.DATA_IMPORT_CREATE,
        DataImportPermission.DATA_IMPORT_UPLOAD, DataImportPermission.DATA_IMPORT_MAP,
        DataImportPermission.DATA_IMPORT_VALIDATE, DataImportPermission.DATA_IMPORT_EXECUTE,
        DataImportPermission.DATA_IMPORT_APPROVE, DataImportPermission.DATA_IMPORT_CANCEL,
        DataImportPermission.DATA_IMPORT_RETRY, DataImportPermission.DATA_IMPORT_VIEW_SENSITIVE,
        DataImportPermission.DATA_IMPORT_VIEW_AUDIT
    ],
    project_manager: [
        DataImportPermission.DATA_IMPORT_VIEW, DataImportPermission.DATA_IMPORT_CREATE,
        DataImportPermission.DATA_IMPORT_UPLOAD, DataImportPermission.DATA_IMPORT_MAP,
        DataImportPermission.DATA_IMPORT_VALIDATE, DataImportPermission.DATA_IMPORT_EXECUTE,
        DataImportPermission.DATA_IMPORT_APPROVE, DataImportPermission.DATA_IMPORT_CANCEL,
        DataImportPermission.DATA_IMPORT_RETRY, DataImportPermission.DATA_IMPORT_VIEW_SENSITIVE,
        DataImportPermission.DATA_IMPORT_VIEW_AUDIT
    ],
    employee: [
        DataImportPermission.DATA_IMPORT_VIEW,
        DataImportPermission.DATA_IMPORT_CREATE,
        DataImportPermission.DATA_IMPORT_UPLOAD,
        DataImportPermission.DATA_IMPORT_VALIDATE,
        DataImportPermission.DATA_IMPORT_CANCEL
    ]
};
function normalizeRoles(raw) {
    return (raw || '')
        .split(',')
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean)
        .map((role) => ({
        import_admin: 'admin',
        superadmin: 'superadmin',
        import_operator: 'operator',
        import_approver: 'lead',
        import_reviewer: 'lead',
        data_manager: 'operator'
    }[role] || role));
}
function parsePermissionHeader(raw) {
    if (!raw)
        return [];
    return raw
        .split(',')
        .map((permission) => permission.trim())
        .filter(Boolean)
        .map((permission) => {
        const enumValue = DataImportPermission[permission];
        return (enumValue || permission);
    });
}
function permissionsForRoles(roles) {
    const permissions = new Set();
    for (const role of roles) {
        for (const permission of ROLE_PERMISSIONS[role] || [])
            permissions.add(permission);
    }
    return [...permissions];
}
/**
 * Extracts security context from the development/test adapter headers.
 * In the real Avyoma host application these values must come from verified
 * authentication/tenant context, never from an untrusted browser payload.
 */
export function securityContextMiddleware(req, _res, next) {
    // Public health/static routes do not require an import security context.
    // API routes are protected below.
    if (!req.path.startsWith('/api/v1/data-imports')) {
        return next();
    }
    let organizationId = req.headers['x-organization-id'] ||
        req.headers['x-tenant-id'];
    let userId = req.headers['x-user-id'];
    // Standalone development/test adapter: preserve the documented optional role/permission
    // headers while making the fallback explicit and impossible in production. The real
    // Avyoma host must inject verified identity and tenant claims.
    const isProduction = process.env.NODE_ENV === 'production';
    if ((!organizationId || !userId) && !isProduction) {
        organizationId ||= 'org_default_tenant';
        userId ||= 'user_default_actor';
    }
    if (!organizationId || !userId) {
        return next(new UnauthorizedError('Missing authenticated organization or user context'));
    }
    let roles = normalizeRoles(req.headers['x-user-roles']);
    const declaredPermissions = parsePermissionHeader(req.headers['x-user-permissions'] ||
        req.headers['x-permissions']);
    if (roles.length === 0 && declaredPermissions.length === 0 && !isProduction) {
        roles = ['admin'];
    }
    // Role permissions are the maximum authority a caller can exercise.
    // Declared permissions are only a development/test adapter and are intersected
    // with role permissions so a client cannot escalate by adding a permission header.
    const rolePermissions = permissionsForRoles(roles);
    const permissions = roles.length
        ? rolePermissions.filter((permission) => declaredPermissions.length === 0 || declaredPermissions.includes(permission))
        : declaredPermissions;
    req.securityContext = {
        organizationId,
        userId,
        roles,
        permissions,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
    };
    next();
}
export function requirePermission(permission) {
    return (req, _res, next) => {
        if (!req.securityContext) {
            return next(new UnauthorizedError('Missing security context'));
        }
        if (!hasPermission(req.securityContext, permission)) {
            return next(new ForbiddenError(`User lacks required permission '${permission}' for this operation`));
        }
        next();
    };
}
//# sourceMappingURL=auth.middleware.js.map