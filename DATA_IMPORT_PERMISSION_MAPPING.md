# Data Import Centre — RBAC & Permission Mapping

This document establishes the bidirectional mapping between Data Import operations, granular permissions, and host application roles.

---

## 1. Permission Hierarchy

The Data Import Centre defines 10 atomic actions. In host environments without fine-grained permissions, these collapse into standard hierarchical roles.

```text
Action Level:
Create Import ──► Upload ──► Edit Mapping ──► Validate ──► Review ──► Approve ──► Execute ──► Retry ──► View Report ──► Export ──► View Audit
```

---

## 2. Granular Action to Permission & Role Matrix

| Data Import Action | Required Action Code | Host Permission Equivalent | Minimum Host Role (Default) | Segregation of Duties Rule |
| :--- | :--- | :--- | :--- | :--- |
| **Create Import** | `IMPORT_CREATE` | `imports.create` | `IMPORT_OPERATOR`, `MEMBER`, `ADMIN` | — |
| **Upload File** | `IMPORT_UPLOAD` | `imports.upload` | `IMPORT_OPERATOR`, `MEMBER`, `ADMIN` | — |
| **Edit Mapping** | `IMPORT_MAPPING_EDIT` | `imports.mapping.manage` | `IMPORT_OPERATOR`, `ADMIN` | — |
| **Run Validation** | `IMPORT_VALIDATE` | `imports.validate` | `IMPORT_OPERATOR`, `ADMIN` | — |
| **Review Staged Records**| `IMPORT_REVIEW` | `imports.review` | `IMPORT_REVIEWER`, `ADMIN` | — |
| **Approve Import** | `IMPORT_APPROVE` | `imports.approve` | `IMPORT_APPROVER`, `ADMIN` | Cannot be same user as Creator if 4-eyes enabled |
| **Execute Import** | `IMPORT_EXECUTE` | `imports.execute` | `IMPORT_OPERATOR`, `ADMIN` | Requires status `APPROVED` |
| **Retry Failed Batch** | `IMPORT_RETRY` | `imports.retry` | `IMPORT_OPERATOR`, `ADMIN` | — |
| **View Report / Reconcile**| `IMPORT_REPORT_VIEW`| `imports.reports.read` | `VIEWER`, `MEMBER`, `ADMIN` | Read-only |
| **Export Error/Reconcile**| `IMPORT_EXPORT` | `imports.export` | `IMPORT_OPERATOR`, `ADMIN` | Data export controls |
| **View Audit Trail** | `IMPORT_AUDIT_VIEW` | `audit.read`, `imports.audit`| `AUDITOR`, `COMPLIANCE`, `ADMIN`| Read-only |

---

## 3. Host Role Archetype Mappings

### Scenario A: Standard 3-Tier Enterprise Role Model (`ADMIN`, `OPERATOR`, `VIEWER`)
- **`ADMIN`**: Inherits all permissions (`IMPORT_CREATE`, `IMPORT_UPLOAD`, `IMPORT_MAPPING_EDIT`, `IMPORT_VALIDATE`, `IMPORT_REVIEW`, `IMPORT_APPROVE`, `IMPORT_EXECUTE`, `IMPORT_RETRY`, `IMPORT_REPORT_VIEW`, `IMPORT_EXPORT`, `IMPORT_AUDIT_VIEW`).
- **`OPERATOR` / `MEMBER`**: Can create, upload, map, validate, review, execute (if pre-approved), retry, view reports, and export.
- **`VIEWER`**: Can only view reports and reconciliation summaries (`IMPORT_REPORT_VIEW`).

### Scenario B: Strict Segregation of Duties (Dual-Control / 4-Eyes Compliance)
- **Role: `IMPORT_CREATOR`**: Can upload and stage files, edit mappings, and trigger validation. Blocked from `IMPORT_APPROVE`.
- **Role: `IMPORT_APPROVER`**: Can review staged batches, inspect validation errors, and grant execution sign-off. Blocked from `IMPORT_EXECUTE`.
- **Role: `IMPORT_EXECUTOR`**: Can trigger final commit to production target tables once approved.
- **Role: `COMPLIANCE_AUDITOR`**: Has exclusive read access to `data_import_audit_logs` and reconciliation variance reports.

---

## 4. Middleware Integration Hook

The permission check is evaluated in `src/api/middleware/auth.middleware.ts`:

```typescript
export function requireImportPermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = req.securityContext;
    if (!context) {
      return res.status(401).json({ error: 'Unauthorized: Security context missing' });
    }
    
    // Admins bypass granular checks
    if (context.roles.includes('ADMIN') || context.roles.includes('SUPERADMIN')) {
      return next();
    }
    
    // Check permission list
    if (context.permissions.includes(permission)) {
      return next();
    }
    
    return res.status(403).json({
      error: `Forbidden: User lacks required permission '${permission}'`,
      requiredPermission: permission,
    });
  };
}
```
