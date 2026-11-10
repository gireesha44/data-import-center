/**
 * Centralized 14-Module Registry for Enterprise Data Import Centre
 * Defines department/module contexts, permissions, allowed roles, entities, and rules.
 */
export interface DepartmentModuleConfig {
    id: string;
    name: string;
    displayName: string;
    description: string;
    icon: string;
    allowedRoles: string[];
    entities: string[];
    templates: string[];
}
export declare const MODULE_REGISTRY: Record<string, DepartmentModuleConfig>;
/**
 * Normalizes role codes to standard RBAC role identifiers.
 */
export declare function normalizeRoleCode(rawRole?: string): string;
/**
 * Returns all modules allowed for a given user role.
 */
export declare function getModulesForRole(roleCode?: string): DepartmentModuleConfig[];
/**
 * Gets specific department configuration by ID.
 */
export declare function getModuleConfig(moduleId: string): DepartmentModuleConfig | undefined;
//# sourceMappingURL=module.registry.d.ts.map