# DATA IMPORT CENTRE — ACCESS CONTROL & RBAC MATRIX

This document specifies the Role-Based Access Control (RBAC) model, permissions tokens, and operational access matrix for the Data Import Centre.

---

## 1. Role Definitions

| Role Code | Role Name | Description |
| :--- | :--- | :--- |
| `admin` | **System Administrator** | Full administrative privileges, approvals, tenant configuration, and metrics access. |
| `lead` / `manager` | **Data Governance Lead** | Reviewer and approver for sensitive imports; separation of duties signoff. |
| `operator` | **Import Operator** | Day-to-day data import creation, mapping, validation, execution, and retry operations. |
| `user` | **Standard User** | Basic creation and view permissions. |
| `viewer` / `auditor` | **Auditor / Read-Only** | Read-only access to import status, reports, and immutable audit logs. |

---

## 2. Permission Token Definitions

| Permission Token | Description |
| :--- | :--- |
| `DATA_IMPORT_CREATE` | Ability to initialize draft import jobs. |
| `DATA_IMPORT_VIEW` | Ability to view import metadata, schemas, mappings, and reports. |
| `DATA_IMPORT_UPLOAD` | Ability to upload source files and stage payloads. |
| `DATA_IMPORT_MAP` | Ability to configure, edit, and save column mapping definitions. |
| `DATA_IMPORT_VALIDATE` | Ability to trigger transformation, validation, and duplicate detection pipelines. |
| `DATA_IMPORT_APPROVE` | Ability to formally approve or reject imports for batch execution. |
| `DATA_IMPORT_EXECUTE` | Ability to trigger transactional batch execution and retries into target systems. |
| `DATA_IMPORT_CANCEL` | Ability to cancel active, unexecuted imports. |

---

## 3. Operational Access Control Matrix

| API Action / Operation | Required Permission Token | Allowed Roles | Anti-Self Policy Active |
| :--- | :--- | :--- | :---: |
| **List Entities & Schemas** | `DATA_IMPORT_VIEW` | `admin`, `lead`, `operator`, `user`, `viewer` | No |
| **Create Import Draft** | `DATA_IMPORT_CREATE` | `admin`, `operator`, `user` | No |
| **Upload Source File** | `DATA_IMPORT_UPLOAD` | `admin`, `operator`, `user` | No |
| **Parse File & Preview** | `DATA_IMPORT_VALIDATE` | `admin`, `operator`, `user` | No |
| **Configure Column Mapping**| `DATA_IMPORT_MAP` | `admin`, `operator` | No |
| **Validate Staged Records** | `DATA_IMPORT_VALIDATE` | `admin`, `operator` | No |
| **Detect Duplicates & Match**| `DATA_IMPORT_VALIDATE` | `admin`, `operator` | No |
| **Pre-Execution Review** | `DATA_IMPORT_VIEW` | `admin`, `lead`, `operator`, `viewer` | No |
| **Approve / Reject Import** | `DATA_IMPORT_APPROVE` | `admin`, `lead` | **YES (Creator != Approver)** |
| **Execute Import** | `DATA_IMPORT_EXECUTE` | `admin`, `operator` | No |
| **Post-Import Reconcile** | `DATA_IMPORT_VALIDATE` | `admin`, `operator` | No |
| **View Final Report** | `DATA_IMPORT_VIEW` | `admin`, `lead`, `operator`, `viewer` | No |
| **Export Report / CSV** | `DATA_IMPORT_VIEW` | `admin`, `lead`, `operator`, `viewer` | No |
| **Retry Failed Records** | `DATA_IMPORT_EXECUTE` | `admin`, `operator` | No |
| **Cancel Import** | `DATA_IMPORT_CANCEL` | `admin`, `operator`, `user` | No |
| **Prometheus Metrics** | Public / Internal Scoped | `admin`, `operator`, monitoring agents | No |
