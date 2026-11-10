/**
 * Security & RBAC Middleware for Data Import Centre
 */
import { Request, Response, NextFunction } from 'express';
import { SecurityContext, DataImportPermission } from '../../core/types/permissions.types.js';
declare global {
    namespace Express {
        interface Request {
            securityContext?: SecurityContext;
        }
    }
}
/**
 * Extracts security context from the development/test adapter headers.
 * In the real Avyoma host application these values must come from verified
 * authentication/tenant context, never from an untrusted browser payload.
 */
export declare function securityContextMiddleware(req: Request, _res: Response, next: NextFunction): void;
export declare function requirePermission(permission: DataImportPermission): (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map