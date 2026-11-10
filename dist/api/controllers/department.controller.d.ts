/**
 * Department Context Controller for Data Import Centre
 * Provides modular, configuration-driven endpoints per department context.
 */
import { Request, Response, NextFunction } from 'express';
import { IDataImportRepository } from '../../domain/repositories/data-import.repository.interface.js';
import { TemplateService } from '../../domain/services/template.service.js';
export declare class DepartmentController {
    private readonly importRepository;
    private readonly templateService;
    constructor(importRepository: IDataImportRepository, templateService: TemplateService);
    private getAuthorizedModules;
    private getImportModuleId;
    /**
     * Helper to verify caller is authorized for the requested department.
     */
    private checkDepartmentAuthorization;
    /**
     * GET /api/v1/data-imports/departments
     * Returns authorized departments for the caller's role context.
     */
    getDepartments: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /api/v1/data-imports/departments/:departmentId/dashboard
     * Returns department-aware KPI metrics and recent import jobs.
     */
    getDepartmentDashboard: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /api/v1/data-imports/departments/:departmentId/entities
     */
    getDepartmentEntities: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /api/v1/data-imports/departments/:departmentId/templates
     */
    getDepartmentTemplates: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /api/v1/data-imports/departments/:departmentId/schemas
     */
    getDepartmentSchemas: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /api/v1/data-imports/departments/:departmentId/imports
     */
    getDepartmentImports: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /api/v1/data-imports/departments/:departmentId/audit-logs
     */
    getDepartmentAuditLogs: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=department.controller.d.ts.map