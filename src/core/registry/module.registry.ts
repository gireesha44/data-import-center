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

export const MODULE_REGISTRY: Record<string, DepartmentModuleConfig> = {
  finance: {
    id: 'finance',
    name: 'Finance',
    displayName: 'Finance & Accounting',
    description: 'Invoices, customer billing, payments, journal entries, and corporate expenses',
    icon: '💰',
    allowedRoles: ['admin', 'org_admin', 'finance_admin'],
    entities: ['invoices', 'payments', 'expenses', 'customers'],
    templates: ['Invoice Template', 'Payment Template', 'Expense Report Template', 'Customer Master Template']
  },
  hr: {
    id: 'hr',
    name: 'HR',
    displayName: 'Human Resources',
    description: 'Employee directory, attendance, payroll records, and organizational roles',
    icon: '👥',
    allowedRoles: ['admin', 'org_admin', 'hr_admin', 'employee'],
    entities: ['employees', 'attendance', 'payroll'],
    templates: ['Employee Master Template', 'Attendance Log Template', 'Payroll Digest Template']
  },
  procurement: {
    id: 'procurement',
    name: 'Procurement',
    displayName: 'Procurement & Sourcing',
    description: 'Approved vendor directory, purchase orders, commercial tender bids, and shipments',
    icon: '📦',
    allowedRoles: ['admin', 'org_admin', 'procurement_manager'],
    entities: ['vendors', 'purchase_orders', 'tenders', 'shipments'],
    templates: ['Vendor Master Template', 'Purchase Order Template', 'Tender Bids Template', 'Shipment Manifest Template']
  },
  sales: {
    id: 'sales',
    name: 'Sales',
    displayName: 'Sales & CRM',
    description: 'Customer contact records, business accounts, lead pipelines, and deals',
    icon: '📈',
    allowedRoles: ['admin', 'org_admin', 'sales_manager'],
    entities: ['contacts', 'customers', 'deals'],
    templates: ['Contact Import Template', 'Customer Account Template', 'Deals Pipeline Template']
  },
  compliance: {
    id: 'compliance',
    name: 'Compliance',
    displayName: 'Governance & Compliance',
    description: 'Regulatory audit logs, compliance control filings, policy reviews, and risk records',
    icon: '🛡️',
    allowedRoles: ['admin', 'org_admin', 'compliance_manager'],
    entities: ['compliance_records'],
    templates: ['Compliance Audit Record Template']
  },
  projects: {
    id: 'projects',
    name: 'Projects',
    displayName: 'Project Management Office',
    description: 'Enterprise project portfolio, milestones, task assignments, and time logs',
    icon: '📊',
    allowedRoles: ['admin', 'org_admin', 'project_manager', 'employee'],
    entities: ['projects'],
    templates: ['Project Master Template']
  },
  inventory: {
    id: 'inventory',
    name: 'Inventory',
    displayName: 'Warehouse & Inventory',
    description: 'Product SKUs, catalog definitions, warehouse stock balances, and item counts',
    icon: '🏬',
    allowedRoles: ['admin', 'org_admin', 'procurement_manager'],
    entities: ['products', 'inventory'],
    templates: ['Product Catalog Template', 'Stock Level Template']
  },
  supply_chain: {
    id: 'supply_chain',
    name: 'Supply Chain',
    displayName: 'Logistics & Supply Chain',
    description: 'Freight movements, consignment tracking, logistics carriers, and routes',
    icon: '🚚',
    allowedRoles: ['admin', 'org_admin', 'procurement_manager'],
    entities: ['shipments'],
    templates: ['Logistics Manifest Template']
  },
  manufacturing: {
    id: 'manufacturing',
    name: 'Manufacturing',
    displayName: 'Production & Manufacturing',
    description: 'Work orders, bill of materials (BOM), production yields, and plant assembly logs',
    icon: '⚙️',
    allowedRoles: ['admin', 'org_admin', 'project_manager'],
    entities: ['work_orders'],
    templates: ['Work Order Batch Template']
  },
  assets: {
    id: 'assets',
    name: 'Assets',
    displayName: 'Enterprise Asset Management',
    description: 'Fixed assets register, equipment serials, maintenance schedules, and depreciation',
    icon: '🏢',
    allowedRoles: ['admin', 'org_admin', 'finance_admin'],
    entities: ['enterprise_assets'],
    templates: ['Asset Register Template']
  },
  itsm: {
    id: 'itsm',
    name: 'IT Service Management',
    displayName: 'IT Service & Infrastructure',
    description: 'Hardware IT inventory, software licenses, service desk tickets, and user access',
    icon: '💻',
    allowedRoles: ['admin', 'org_admin', 'project_manager', 'employee'],
    entities: ['it_tickets'],
    templates: ['IT Ticket Ingestion Template']
  },
  legal: {
    id: 'legal',
    name: 'Legal',
    displayName: 'Legal & Contracts',
    description: 'Commercial agreements, non-disclosure contracts, litigation filings, and legal terms',
    icon: '⚖️',
    allowedRoles: ['admin', 'org_admin', 'compliance_manager'],
    entities: ['legal_contracts'],
    templates: ['Legal Contract Template']
  },
  marketing: {
    id: 'marketing',
    name: 'Marketing',
    displayName: 'Marketing Campaigns & Leads',
    description: 'Campaign tracking, digital lead lists, ad performance logs, and event registries',
    icon: '🎯',
    allowedRoles: ['admin', 'org_admin', 'sales_manager'],
    entities: ['marketing_campaigns'],
    templates: ['Campaign Leads Template']
  },
  operations: {
    id: 'operations',
    name: 'Operations',
    displayName: 'Executive Operations & Facilities',
    description: 'Site locations, facilities tickets, operational metrics, and executive KPIs',
    icon: '🌐',
    allowedRoles: ['admin', 'org_admin', 'hr_admin', 'project_manager'],
    entities: ['facility_tickets'],
    templates: ['Facility Audit Template']
  }
};

/**
 * Normalizes role codes to standard RBAC role identifiers.
 */
export function normalizeRoleCode(rawRole?: string): string {
  if (!rawRole) return 'employee';
  const cleaned = rawRole.trim().toLowerCase();

  const roleMap: Record<string, string> = {
    admin: 'admin',
    org_admin: 'org_admin',
    organization_admin: 'org_admin',
    hr_admin: 'hr_admin',
    finance_admin: 'finance_admin',
    procurement_manager: 'procurement_manager',
    sales_manager: 'sales_manager',
    compliance_manager: 'compliance_manager',
    project_manager: 'project_manager',
    employee: 'employee',
    import_operator: 'admin',
    import_approver: 'admin',
    operator: 'admin',
    lead: 'admin',
    manager: 'admin',
    viewer: 'employee'
  };

  return roleMap[cleaned] || cleaned;
}

/**
 * Returns all modules allowed for a given user role.
 */
export function getModulesForRole(roleCode?: string): DepartmentModuleConfig[] {
  const normRole = normalizeRoleCode(roleCode);

  if (normRole === 'admin' || normRole === 'org_admin') {
    return Object.values(MODULE_REGISTRY);
  }

  return Object.values(MODULE_REGISTRY).filter((module) =>
    module.allowedRoles.includes(normRole)
  );
}

/**
 * Gets specific department configuration by ID.
 */
export function getModuleConfig(moduleId: string): DepartmentModuleConfig | undefined {
  if (!moduleId) return undefined;
  const key = moduleId.toLowerCase();
  if (key === 'crm') return MODULE_REGISTRY['sales'];
  return MODULE_REGISTRY[key] || Object.values(MODULE_REGISTRY).find((m) => m.id.toLowerCase() === key);
}
