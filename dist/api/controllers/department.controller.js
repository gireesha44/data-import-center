/**
 * Department Context Controller for Data Import Centre
 * Provides modular, configuration-driven endpoints per department context.
 */
import { getModulesForRole, getModuleConfig, normalizeRoleCode } from '../../core/registry/module.registry.js';
import { entitySchemaRegistry } from '../../core/registry/entity-schema.registry.js';
import { auditService } from '../../infrastructure/services/audit.service.js';
import { ImportStatus } from '../../core/types/import.types.js';
import { ForbiddenError } from '../../core/errors/import.errors.js';
export class DepartmentController {
    importRepository;
    templateService;
    constructor(importRepository, templateService) {
        this.importRepository = importRepository;
        this.templateService = templateService;
    }
    getAuthorizedModules(req) {
        const contextRoles = req.securityContext?.roles || [];
        const roles = contextRoles.length
            ? contextRoles
            : [(req.query.role || 'org_admin')];
        const modules = roles.flatMap((role) => getModulesForRole(role));
        return Array.from(new Map(modules.map((module) => [module.id.toLowerCase(), module])).values());
    }
    getImportModuleId(importItem) {
        const declaredModule = importItem.targetModule?.trim();
        if (declaredModule) {
            const config = getModuleConfig(declaredModule);
            return (config?.id || declaredModule).toLowerCase();
        }
        const schema = entitySchemaRegistry.listEntities().find((entity) => entity.entity.toLowerCase() === importItem.targetEntity.toLowerCase());
        return schema?.module.toLowerCase() || '';
    }
    /**
     * Helper to verify caller is authorized for the requested department.
     */
    checkDepartmentAuthorization(req, departmentId) {
        const isGlobal = departmentId.toLowerCase() === 'global';
        if (isGlobal)
            return;
        const context = req.securityContext;
        const roles = context?.roles?.length
            ? context.roles
            : [(req.query.role || 'org_admin')];
        const isCrossDeptAdmin = roles.some((r) => {
            const norm = normalizeRoleCode(r);
            return ['admin', 'superadmin', 'org_admin'].includes(norm);
        });
        if (isCrossDeptAdmin)
            return;
        const targetConfig = getModuleConfig(departmentId);
        const targetModuleId = targetConfig ? targetConfig.id.toLowerCase() : departmentId.toLowerCase();
        const allowedModules = roles.flatMap((role) => getModulesForRole(role));
        const isAllowed = allowedModules.some((m) => m.id.toLowerCase() === targetModuleId || m.id.toLowerCase() === departmentId.toLowerCase());
        if (!isAllowed) {
            throw new ForbiddenError(`Department '${departmentId}' is not authorized for current user role(s)`);
        }
    }
    /**
     * GET /api/v1/data-imports/departments
     * Returns authorized departments for the caller's role context.
     */
    getDepartments = async (req, res, next) => {
        try {
            const context = req.securityContext;
            const modules = this.getAuthorizedModules(req);
            // Fetch all imports for tenant to compute counts per department
            const allImports = await this.importRepository.findMany(context?.organizationId || 'org_default_tenant', {
                limit: 10000
            });
            const data = await Promise.all(modules.map(async (mod) => {
                const modEntities = entitySchemaRegistry
                    .listEntities()
                    .filter((e) => e.module.toLowerCase() === mod.id.toLowerCase());
                const deptImports = allImports.data.filter((imp) => this.getImportModuleId(imp) === mod.id.toLowerCase());
                return {
                    id: mod.id,
                    name: mod.name,
                    displayName: mod.displayName,
                    description: mod.description,
                    icon: mod.icon,
                    allowedRoles: mod.allowedRoles,
                    entityCount: modEntities.length,
                    templateCount: mod.templates.length,
                    recentImportCount: deptImports.length,
                    entities: modEntities.map((e) => ({
                        entity: e.entity,
                        displayName: e.displayName,
                        description: e.description
                    })),
                    templates: mod.templates
                };
            }));
            res.status(200).json({
                success: true,
                data
            });
        }
        catch (err) {
            next(err);
        }
    };
    /**
     * GET /api/v1/data-imports/departments/:departmentId/dashboard
     * Returns department-aware KPI metrics and recent import jobs.
     */
    getDepartmentDashboard = async (req, res, next) => {
        try {
            const context = req.securityContext;
            const { departmentId } = req.params;
            this.checkDepartmentAuthorization(req, departmentId);
            const orgId = context?.organizationId || 'org_default_tenant';
            const isGlobal = departmentId.toLowerCase() === 'global';
            const modConfig = !isGlobal ? getModuleConfig(departmentId) : null;
            const allImports = await this.importRepository.findMany(orgId, { limit: 10000 });
            const filteredJobs = isGlobal
                ? allImports.data.filter((imp) => this.getAuthorizedModules(req).some((module) => this.getImportModuleId(imp) === module.id.toLowerCase()))
                : allImports.data.filter((imp) => this.getImportModuleId(imp) === (modConfig?.id || departmentId).toLowerCase());
            const totalJobs = filteredJobs.length;
            const completedJobs = filteredJobs.filter((j) => j.status === ImportStatus.COMPLETED || j.status === ImportStatus.COMPLETED_WITH_ERRORS).length;
            const pendingApproval = filteredJobs.filter((j) => j.status === ImportStatus.PENDING_APPROVAL || j.status === ImportStatus.REQUIRES_APPROVAL).length;
            const totalRecords = filteredJobs.reduce((acc, j) => acc + (j.totalRecords || 0), 0);
            // Sort recent jobs by createdAt DESC
            const recentJobs = [...filteredJobs]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 20);
            res.status(200).json({
                success: true,
                data: {
                    department: isGlobal ? { id: 'global', name: 'Global Data Import Centre', icon: '🌐' } : modConfig,
                    metrics: {
                        totalJobs,
                        completedJobs,
                        pendingApproval,
                        totalRecords
                    },
                    recentJobs
                }
            });
        }
        catch (err) {
            next(err);
        }
    };
    /**
     * GET /api/v1/data-imports/departments/:departmentId/entities
     */
    getDepartmentEntities = async (req, res, next) => {
        try {
            const { departmentId } = req.params;
            this.checkDepartmentAuthorization(req, departmentId);
            const isGlobal = departmentId.toLowerCase() === 'global';
            const allEntities = entitySchemaRegistry.listEntities();
            const entities = isGlobal
                ? allEntities
                : allEntities.filter((e) => e.module.toLowerCase() === departmentId.toLowerCase());
            res.status(200).json({
                success: true,
                data: entities
            });
        }
        catch (err) {
            next(err);
        }
    };
    /**
     * GET /api/v1/data-imports/departments/:departmentId/templates
     */
    getDepartmentTemplates = async (req, res, next) => {
        try {
            const { departmentId } = req.params;
            this.checkDepartmentAuthorization(req, departmentId);
            const isGlobal = departmentId.toLowerCase() === 'global';
            const allEntities = entitySchemaRegistry.listEntities();
            const targetEntities = isGlobal
                ? allEntities
                : allEntities.filter((e) => e.module.toLowerCase() === departmentId.toLowerCase());
            const templates = targetEntities.map((e) => this.templateService.getTemplateMetadata(e.entity));
            res.status(200).json({
                success: true,
                data: templates
            });
        }
        catch (err) {
            next(err);
        }
    };
    /**
     * GET /api/v1/data-imports/departments/:departmentId/schemas
     */
    getDepartmentSchemas = async (req, res, next) => {
        try {
            const { departmentId } = req.params;
            this.checkDepartmentAuthorization(req, departmentId);
            const isGlobal = departmentId.toLowerCase() === 'global';
            const allEntities = entitySchemaRegistry.listEntities();
            const targetEntities = isGlobal
                ? allEntities
                : allEntities.filter((e) => e.module.toLowerCase() === departmentId.toLowerCase());
            res.status(200).json({
                success: true,
                data: targetEntities
            });
        }
        catch (err) {
            next(err);
        }
    };
    /**
     * GET /api/v1/data-imports/departments/:departmentId/imports
     */
    getDepartmentImports = async (req, res, next) => {
        try {
            const context = req.securityContext;
            const { departmentId } = req.params;
            this.checkDepartmentAuthorization(req, departmentId);
            const orgId = context?.organizationId || 'org_default_tenant';
            const isGlobal = departmentId.toLowerCase() === 'global';
            const result = await this.importRepository.findMany(orgId, { limit: 1000 });
            const filtered = isGlobal
                ? result.data.filter((imp) => this.getAuthorizedModules(req).some((module) => this.getImportModuleId(imp) === module.id.toLowerCase()))
                : result.data.filter((imp) => this.getImportModuleId(imp) === departmentId.toLowerCase());
            res.status(200).json({
                success: true,
                data: filtered
            });
        }
        catch (err) {
            next(err);
        }
    };
    /**
     * GET /api/v1/data-imports/departments/:departmentId/audit-logs
     */
    getDepartmentAuditLogs = async (req, res, next) => {
        try {
            const context = req.securityContext;
            const { departmentId } = req.params;
            this.checkDepartmentAuthorization(req, departmentId);
            const orgId = context?.organizationId || 'org_default_tenant';
            const logs = await auditService.getAuditTrail(orgId);
            res.status(200).json({
                success: true,
                data: logs
            });
        }
        catch (err) {
            next(err);
        }
    };
}
//# sourceMappingURL=department.controller.js.map