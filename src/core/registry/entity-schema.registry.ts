/**
 * Entity Schema Registry for Data Import Centre
 * Single authoritative source of truth for importable entities and field metadata
 */

import { ValidationError } from '../errors/import.errors.js';

export type FieldDataType =
  | 'STRING'
  | 'NUMBER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'EMAIL'
  | 'PHONE'
  | 'ENUM'
  | 'IDENTIFIER'
  | 'REFERENCE';

export interface FieldValidationRuleDefinition {
  rule: string;
  parameters?: Record<string, unknown>;
  message?: string;
  severity?: 'ERROR' | 'WARNING' | 'INFORMATION';
}

export interface FieldConstraints {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  sensitive?: boolean;
}

export interface EntityFieldDefinition {
  name: string;
  label: string;
  type: FieldDataType;
  required: boolean;
  nullable?: boolean;
  readOnly?: boolean;
  unique?: boolean;
  description?: string;
  example?: string;
  format?: string;
  enumValues?: string[];
  /** Explicit source/value aliases that may be safely normalized to enum values. */
  enumAliases?: Record<string, string>;
  aliases?: string[];
  referenceTarget?: {
    entity: string;
    lookupKey: string;
    valueKey: string;
  };
  validationRules?: FieldValidationRuleDefinition[];
  constraints?: FieldConstraints;
  defaultValue?: unknown;
}

export interface DuplicateRuleDefinition {
  name: string;
  fields: string[];
  strategy: 'EXACT_MATCH' | 'CASE_INSENSITIVE' | 'COMPOSITE';
  isDefault?: boolean;
}

export interface ApprovalPolicyDefinition {
  requiresApproval: boolean;
  thresholdRowCount?: number;
  restrictedRoles?: string[];
  requireForUpdateMode?: boolean;
  approverRoles?: string[];
  approverLabel?: string;
}

export interface EntitySchemaDefinition {
  module: string;
  entity: string;
  displayName: string;
  description?: string;
  version: number;
  isImportable?: boolean;
  fields: Record<string, EntityFieldDefinition>;
  duplicateRules: DuplicateRuleDefinition[];
  approvalPolicy?: ApprovalPolicyDefinition;
}

export interface IEntitySchemaRegistry {
  registerEntity(schema: EntitySchemaDefinition): void;
  getEntity(entityName: string): EntitySchemaDefinition | undefined;
  listEntities(): EntitySchemaDefinition[];
  hasEntity(entityName: string): boolean;
  getEntityFields(entityName: string): Record<string, EntityFieldDefinition>;
  getField(entityName: string, fieldName: string): EntityFieldDefinition | undefined;
  getRequiredFields(entityName: string): string[];
}

export class EntitySchemaRegistry implements IEntitySchemaRegistry {
  private schemas: Map<string, EntitySchemaDefinition> = new Map();

  public registerEntity(schema: EntitySchemaDefinition): void {
    if (!schema.entity || typeof schema.entity !== 'string' || schema.entity.trim() === '') {
      throw new ValidationError('Cannot register entity without entity name');
    }
    if (!schema.module || typeof schema.module !== 'string' || schema.module.trim() === '') {
      throw new ValidationError(`Cannot register entity '${schema.entity}' without a valid module name`);
    }
    if (!schema.displayName || typeof schema.displayName !== 'string') {
      throw new ValidationError(`Cannot register entity '${schema.entity}' without a displayName`);
    }
    if (!schema.fields || typeof schema.fields !== 'object') {
      schema.fields = {};
    }

    const fieldSet = new Set<string>();
    for (const [key, field] of Object.entries(schema.fields)) {
      if (!field.name || typeof field.name !== 'string') {
        throw new ValidationError(`Field in entity '${schema.entity}' is missing a valid name`);
      }
      if (!field.label || typeof field.label !== 'string') {
        throw new ValidationError(`Field '${field.name}' in entity '${schema.entity}' is missing a label`);
      }
      if (!field.type) {
        throw new ValidationError(`Field '${field.name}' in entity '${schema.entity}' is missing a type`);
      }
      if (field.type === 'ENUM' && (!field.enumValues || field.enumValues.length === 0)) {
        throw new ValidationError(`ENUM field '${field.name}' in entity '${schema.entity}' must specify enumValues`);
      }
      if (fieldSet.has(field.name.toLowerCase())) {
        throw new ValidationError(`Duplicate field name '${field.name}' detected in entity '${schema.entity}'`);
      }
      fieldSet.add(field.name.toLowerCase());
    }

    const key = schema.entity.toLowerCase();
    this.schemas.set(key, {
      ...schema,
      isImportable: schema.isImportable !== undefined ? schema.isImportable : true
    });
  }

  public getEntity(entityName: string): EntitySchemaDefinition | undefined {
    if (!entityName) return undefined;
    return this.schemas.get(entityName.toLowerCase());
  }

  public listEntities(): EntitySchemaDefinition[] {
    return Array.from(this.schemas.values()).filter((e) => e.isImportable !== false);
  }

  public hasEntity(entityName: string): boolean {
    if (!entityName) return false;
    return this.schemas.has(entityName.toLowerCase());
  }

  public getEntityFields(entityName: string): Record<string, EntityFieldDefinition> {
    const entity = this.getEntity(entityName);
    return entity ? entity.fields : {};
  }

  public getField(entityName: string, fieldName: string): EntityFieldDefinition | undefined {
    if (!entityName || !fieldName) return undefined;
    const fields = this.getEntityFields(entityName);
    return fields[fieldName] || Object.values(fields).find((f) => f.name.toLowerCase() === fieldName.toLowerCase());
  }

  public getRequiredFields(entityName: string): string[] {
    const fields = this.getEntityFields(entityName);
    return Object.values(fields)
      .filter((f) => f.required && !f.readOnly)
      .map((f) => f.name);
  }

  public clear(): void {
    this.schemas.clear();
  }
}

// Export singleton instance
export const entitySchemaRegistry = new EntitySchemaRegistry();

// 1. Register Contacts Entity (CRM)
entitySchemaRegistry.registerEntity({
  module: 'crm',
  entity: 'contacts',
  displayName: 'Customer Contacts',
  description: 'CRM Customer contact records with email, phone, and organization references',
  version: 1,
  fields: {
    first_name: {
      name: 'first_name',
      label: 'First Name',
      type: 'STRING',
      required: true,
      description: 'Customer given name',
      example: 'Jane',
      aliases: ['fname', 'given_name', 'first', 'forename', 'first-name', 'firstname']
    },
    last_name: {
      name: 'last_name',
      label: 'Last Name',
      type: 'STRING',
      required: true,
      description: 'Customer family name',
      example: 'Doe',
      aliases: ['lname', 'surname', 'family_name', 'last', 'last-name', 'lastname']
    },
    email: {
      name: 'email',
      label: 'Email Address',
      type: 'EMAIL',
      required: true,
      description: 'Primary contact email',
      example: 'jane.doe@example.com',
      aliases: ['email_address', 'mail', 'contact_email', 'e-mail', 'emailaddress']
    },
    phone: {
      name: 'phone',
      label: 'Phone Number',
      type: 'PHONE',
      required: false,
      description: 'Contact phone in international format',
      example: '+1-555-0199',
      aliases: ['telephone', 'phone_number', 'mobile', 'cell', 'tel', 'phonenumber']
    },
    company: {
      name: 'company',
      label: 'Company Name',
      type: 'STRING',
      required: false,
      description: 'Employer or organization name',
      example: 'Acme Corp',
      aliases: [
        'organization', 'company_name', 'org', 'business', 'employer',
        'customer_name', 'client_name', 'account_name', 'firm'
      ]
    },
    status: {
      name: 'status',
      label: 'Status',
      type: 'ENUM',
      required: false,
      enumValues: ['ACTIVE', 'INACTIVE', 'LEAD', 'CHURNED'],
      defaultValue: 'LEAD',
      aliases: ['contact_status', 'state', 'lead_status']
    },
    id: {
      name: 'id',
      label: 'System ID',
      type: 'IDENTIFIER',
      required: false,
      readOnly: true,
      description: 'Internal system generated identifier'
    }
  },
  duplicateRules: [
    {
      name: 'Email Unique Match',
      fields: ['email'],
      strategy: 'CASE_INSENSITIVE',
      isDefault: true
    },
    {
      name: 'Name and Phone Match',
      fields: ['first_name', 'last_name', 'phone'],
      strategy: 'COMPOSITE'
    }
  ],
  approvalPolicy: {
    requiresApproval: false,
    thresholdRowCount: 5000,
    requireForUpdateMode: true,
    approverRoles: ['sales_manager', 'admin'],
    approverLabel: 'Sales Manager'
  }
});

// 1b. Register Customers Entity (CRM) — exact match for customer import files
//     with columns: customer_code, customer_name, customer_category, account_owner
entitySchemaRegistry.registerEntity({
  module: 'crm',
  entity: 'customers',
  displayName: 'Customer Accounts',
  description: 'CRM B2B customer account records with business code, name, category, account owner, and contact details',
  version: 1,
  fields: {
    customer_code: {
      name: 'customer_code',
      label: 'Customer Code',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      description: 'External business identifier / customer code',
      example: 'CUS-1001',
      aliases: [
        'customer_id', 'cust_code', 'cust_id', 'client_code', 'client_id',
        'account_code', 'account_id', 'external_id', 'customer_number', 'cust_no',
        'customercode', 'customerid'
      ]
    },
    customer_name: {
      name: 'customer_name',
      label: 'Customer Name',
      type: 'STRING',
      required: true,
      description: 'Full legal or trading name of the customer',
      example: 'Acme Industries',
      aliases: [
        'company_name', 'company', 'account_name', 'client_name', 'business_name',
        'organization', 'org_name', 'firm_name', 'name', 'cust_name', 'customername'
      ]
    },
    email: {
      name: 'email',
      label: 'Email Address',
      type: 'EMAIL',
      required: true,
      unique: true,
      description: 'Primary contact or billing email',
      example: 'contact@acme.example.com',
      aliases: ['email_address', 'mail', 'contact_email', 'billing_email', 'e-mail', 'emailaddress']
    },
    phone: {
      name: 'phone',
      label: 'Phone Number',
      type: 'PHONE',
      required: false,
      description: 'Contact phone in international format',
      example: '+91-9000000001',
      aliases: ['telephone', 'phone_number', 'mobile', 'cell', 'tel', 'phonenumber', 'contact_phone']
    },
    customer_category: {
      name: 'customer_category',
      label: 'Customer Category',
      type: 'STRING',
      required: false,
      description: 'Segment or classification (e.g. Retail, Enterprise, SME)',
      example: 'Enterprise',
      aliases: [
        'category', 'segment', 'customer_segment', 'client_category',
        'account_type', 'customer_type', 'tier', 'classification', 'cust_category'
      ]
    },
    account_owner: {
      name: 'account_owner',
      label: 'Account Owner',
      type: 'STRING',
      required: false,
      description: 'Sales representative or account manager for this customer',
      example: 'Alex Rivera',
      aliases: [
        'owner', 'sales_rep', 'sales_representative', 'account_manager', 'am',
        'relationship_manager', 'rm', 'assigned_to', 'managed_by', 'agent'
      ]
    },
    status: {
      name: 'status',
      label: 'Status',
      type: 'ENUM',
      required: false,
      enumValues: ['ACTIVE', 'INACTIVE', 'PROSPECT', 'CHURNED', 'SUSPENDED'],
      defaultValue: 'ACTIVE',
      aliases: ['customer_status', 'account_status', 'state', 'cust_status']
    },
    id: {
      name: 'id',
      label: 'System ID',
      type: 'IDENTIFIER',
      required: false,
      readOnly: true,
      description: 'Internal system generated identifier'
    }
  },
  duplicateRules: [
    {
      name: 'Customer Code Match',
      fields: ['customer_code'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    },
    {
      name: 'Email Match',
      fields: ['email'],
      strategy: 'CASE_INSENSITIVE'
    }
  ],
  approvalPolicy: {
    requiresApproval: false,
    thresholdRowCount: 1000,
    requireForUpdateMode: true,
    approverRoles: ['finance_admin', 'sales_manager', 'admin'],
    approverLabel: 'Finance or Sales Manager'
  }
});

// 2. Register Products Entity (Inventory)
entitySchemaRegistry.registerEntity({
  module: 'inventory',
  entity: 'products',
  displayName: 'Product Catalog',
  description: 'Inventory product items, SKU, category, and pricing',
  version: 1,
  fields: {
    sku: {
      name: 'sku',
      label: 'SKU / Product Code',
      type: 'STRING',
      required: true,
      unique: true,
      description: 'Unique Stock Keeping Unit',
      example: 'PROD-1001',
      aliases: ['product_code', 'item_number', 'item_code', 'sku_number', 'part_number']
    },
    name: {
      name: 'name',
      label: 'Product Name',
      type: 'STRING',
      required: true,
      description: 'Commercial title of the item',
      example: 'Wireless Mechanical Keyboard',
      aliases: ['title', 'product_name', 'item_name', 'product_title', 'description']
    },
    price: {
      name: 'price',
      label: 'Unit Price',
      type: 'DECIMAL',
      required: true,
      description: 'Selling price per unit',
      example: '99.99',
      aliases: ['unit_price', 'cost', 'amount', 'rate', 'retail_price']
    },
    category: {
      name: 'category',
      label: 'Category',
      type: 'STRING',
      required: false,
      description: 'Product grouping category',
      example: 'Electronics',
      aliases: ['product_category', 'department', 'type', 'group']
    },
    stock_quantity: {
      name: 'stock_quantity',
      label: 'Stock Quantity',
      type: 'NUMBER',
      required: false,
      defaultValue: 0,
      description: 'Units currently in stock',
      aliases: ['quantity', 'qty', 'stock', 'inventory_count', 'units']
    }
  },
  duplicateRules: [
    {
      name: 'SKU Match',
      fields: ['sku'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 3. Register Invoices Entity (Finance)
entitySchemaRegistry.registerEntity({
  module: 'finance',
  entity: 'invoices',
  displayName: 'Invoices',
  description: 'Accounts receivable and customer billing records',
  version: 1,
  fields: {
    invoice_number: {
      name: 'invoice_number',
      label: 'Invoice Number',
      type: 'STRING',
      required: true,
      unique: true,
      example: 'INV-2026-001',
      aliases: ['invoice_no', 'inv_number', 'bill_number', 'invoice_id']
    },
    customer_email: {
      name: 'customer_email',
      label: 'Customer Email',
      type: 'EMAIL',
      required: true,
      example: 'billing@customer.com',
      aliases: ['email', 'billing_email', 'client_email', 'customer_mail']
    },
    total_amount: {
      name: 'total_amount',
      label: 'Total Amount',
      type: 'DECIMAL',
      required: true,
      example: '1450.00',
      aliases: ['amount', 'total', 'grand_total', 'invoice_total', 'balance']
    },
    issue_date: {
      name: 'issue_date',
      label: 'Issue Date',
      type: 'DATE',
      required: true,
      example: '2026-03-01',
      aliases: ['date', 'invoice_date', 'billed_at', 'created_date']
    },
    due_date: {
      name: 'due_date',
      label: 'Due Date',
      type: 'DATE',
      required: false,
      example: '2026-03-31',
      aliases: ['payment_due', 'expiry_date', 'due']
    },
    currency: {
      name: 'currency',
      label: 'Currency',
      type: 'STRING',
      required: false,
      defaultValue: 'USD',
      aliases: ['curr', 'currency_code', 'iso_currency']
    },
    status: {
      name: 'status',
      label: 'Status',
      type: 'ENUM',
      required: false,
      enumValues: ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED'],
      defaultValue: 'ISSUED',
      aliases: ['invoice_status', 'payment_status', 'state']
    }
  },
  duplicateRules: [
    {
      name: 'Invoice Number Match',
      fields: ['invoice_number'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 4. Register Employees Entity (HR)
entitySchemaRegistry.registerEntity({
  module: 'hr',
  entity: 'employees',
  displayName: 'Employee Directory',
  description: 'HR Employee records with department, role, email, and contact details',
  version: 1,
  fields: {
    employee_id: {
      name: 'employee_id',
      label: 'Employee ID',
      type: 'IDENTIFIER',
      required: false,
      unique: true,
      description: 'Unique corporate employee code',
      example: 'EMP-1001',
      aliases: ['employee_code', 'emp_id', 'staff_id']
    },
    first_name: {
      name: 'first_name',
      label: 'First Name',
      type: 'STRING',
      required: true,
      description: 'Employee given name',
      example: 'Sarah',
      aliases: ['fname', 'given_name', 'first', 'forename', 'first-name', 'firstname']
    },
    last_name: {
      name: 'last_name',
      label: 'Last Name',
      type: 'STRING',
      required: true,
      description: 'Employee family name',
      example: 'Connor',
      aliases: ['lname', 'surname', 'family_name', 'last', 'last-name', 'lastname']
    },
    email: {
      name: 'email',
      label: 'Email Address',
      type: 'EMAIL',
      required: true,
      unique: true,
      description: 'Corporate email address',
      example: 'sarah.connor@company.com',
      aliases: ['work_email', 'corporate_email', 'mail', 'email_address', 'e-mail']
    },
    phone: {
      name: 'phone',
      label: 'Phone Number',
      type: 'PHONE',
      required: false,
      example: '+1-555-0199',
      aliases: ['mobile', 'cell', 'telephone', 'phone_number', 'tel']
    },
    department: {
      name: 'department',
      label: 'Department',
      type: 'STRING',
      required: false,
      example: 'Engineering',
      aliases: ['dept', 'division', 'team']
    },
    job_title: {
      name: 'job_title',
      label: 'Job Title',
      type: 'STRING',
      required: false,
      example: 'Senior Software Engineer',
      aliases: ['title', 'role', 'position', 'designation']
    },
    status: {
      name: 'status',
      label: 'Status',
      type: 'ENUM',
      required: false,
      enumValues: ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'],
      defaultValue: 'ACTIVE',
      aliases: ['employee_status', 'employment_status', 'state']
    }
  },
  duplicateRules: [
    {
      name: 'Employee ID Match',
      fields: ['employee_id'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    },
    {
      name: 'Email Unique Match',
      fields: ['email'],
      strategy: 'CASE_INSENSITIVE'
    }
  ]
});

// 5. Register Vendors Entity (Procurement)
entitySchemaRegistry.registerEntity({
  module: 'procurement',
  entity: 'vendors',
  displayName: 'Vendor Registry',
  description: 'Approved enterprise suppliers and vendor registration data',
  version: 1,
  fields: {
    vendor_id: {
      name: 'vendor_id',
      label: 'Vendor ID',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'VEN-5001',
      aliases: ['vendor_code', 'supplier_id', 'vendor_no']
    },
    vendor_name: {
      name: 'vendor_name',
      label: 'Vendor Name',
      type: 'STRING',
      required: true,
      example: 'Acme Supply Co',
      aliases: ['supplier_name', 'company_name', 'name']
    },
    registration_number: {
      name: 'registration_number',
      label: 'Registration Identifier',
      type: 'STRING',
      required: false,
      unique: true,
      example: 'REG-994820',
      aliases: ['reg_no', 'tax_id', 'business_reg_no']
    },
    email: {
      name: 'email',
      label: 'Vendor Contact Email',
      type: 'EMAIL',
      required: true,
      example: 'contact@acmesupply.com',
      aliases: ['contact_email', 'supplier_email', 'mail']
    }
  },
  duplicateRules: [
    {
      name: 'Vendor ID Match',
      fields: ['vendor_id'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    },
    {
      name: 'Registration Number Match',
      fields: ['registration_number'],
      strategy: 'EXACT_MATCH'
    }
  ]
});

// 6. Register Inventory Entity (Warehouse)
entitySchemaRegistry.registerEntity({
  module: 'inventory',
  entity: 'inventory',
  displayName: 'Inventory Items',
  description: 'Warehouse stock items and location balances',
  version: 1,
  fields: {
    item_id: {
      name: 'item_id',
      label: 'Item ID',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'ITEM-8001',
      aliases: ['inventory_item_id', 'item_code']
    },
    sku: {
      name: 'sku',
      label: 'SKU',
      type: 'STRING',
      required: true,
      example: 'SKU-KEYBOARD-01',
      aliases: ['product_sku', 'part_number']
    },
    warehouse: {
      name: 'warehouse',
      label: 'Warehouse Code',
      type: 'STRING',
      required: false,
      defaultValue: 'WH-MAIN',
      example: 'WH-EAST-1'
    },
    quantity: {
      name: 'quantity',
      label: 'Quantity',
      type: 'NUMBER',
      required: true,
      defaultValue: 0,
      example: '150'
    }
  },
  duplicateRules: [
    {
      name: 'Item ID Match',
      fields: ['item_id'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    },
    {
      name: 'SKU Match',
      fields: ['sku'],
      strategy: 'EXACT_MATCH'
    }
  ]
});

// 7. Register Projects Entity (PMO)
entitySchemaRegistry.registerEntity({
  module: 'pmo',
  entity: 'projects',
  displayName: 'Project Portfolio',
  description: 'Enterprise project codes, milestones, and governance records',
  version: 1,
  fields: {
    project_code: {
      name: 'project_code',
      label: 'Project Code',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'PRJ-2026-ALPHA',
      aliases: ['project_id', 'proj_code', 'code']
    },
    name: {
      name: 'name',
      label: 'Project Name',
      type: 'STRING',
      required: true,
      example: 'Cloud Data Platform Migration',
      aliases: ['title', 'project_name']
    },
    owner: {
      name: 'owner',
      label: 'Account Owner',
      type: 'STRING',
      required: false,
      example: 'Alex Rivera'
    },
    status: {
      name: 'status',
      label: 'Project Status',
      type: 'ENUM',
      required: false,
      enumValues: ['PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
      defaultValue: 'PLANNED'
    }
  },
  duplicateRules: [
    {
      name: 'Project Code Match',
      fields: ['project_code'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 8. Register Tenders Entity (Procurement)
entitySchemaRegistry.registerEntity({
  module: 'procurement',
  entity: 'tenders',
  displayName: 'Tender Bids',
  description: 'Commercial tender bids and reference contracts',
  version: 1,
  fields: {
    tender_reference_number: {
      name: 'tender_reference_number',
      label: 'Tender Reference Number',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'TND-2026-9921',
      aliases: ['tender_ref', 'tender_id', 'ref_no', 'bid_number']
    },
    title: {
      name: 'title',
      label: 'Tender Title',
      type: 'STRING',
      required: true,
      example: 'National Infrastructure Supply Contract'
    },
    agency: {
      name: 'agency',
      label: 'Issuing Agency',
      type: 'STRING',
      required: false,
      example: 'Department of Public Works'
    },
    amount: {
      name: 'amount',
      label: 'Tender Value Amount',
      type: 'DECIMAL',
      required: true,
      example: '500000.00'
    }
  },
  duplicateRules: [
    {
      name: 'Tender Reference Match',
      fields: ['tender_reference_number'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 9. Register Shipments Entity (Procurement / Supply Chain)
entitySchemaRegistry.registerEntity({
  module: 'procurement',
  entity: 'shipments',
  displayName: 'Logistics Shipments',
  description: 'Freight shipments, origins, destinations, carriers, and dispatch tracking',
  version: 1,
  fields: {
    shipment_reference: {
      name: 'shipment_reference',
      label: 'Shipment Reference',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'SHP-1001',
      aliases: ['shipment_id', 'shipment_ref', 'tracking_number', 'tracking_no', 'waybill', 'consignment_number', 'shipment_number']
    },
    origin: {
      name: 'origin',
      label: 'Origin Location',
      type: 'STRING',
      required: true,
      example: 'Hyderabad',
      aliases: ['origin_city', 'dispatch_from', 'source', 'from_location', 'departure', 'origin_location']
    },
    destination: {
      name: 'destination',
      label: 'Destination Location',
      type: 'STRING',
      required: true,
      example: 'Mumbai',
      aliases: ['destination_city', 'ship_to', 'target_location', 'arrival_location', 'to_location', 'destination_location']
    },
    carrier: {
      name: 'carrier',
      label: 'Logistics Carrier',
      type: 'STRING',
      required: false,
      example: 'Express Logistics',
      aliases: ['courier', 'logistics_provider', 'transporter', 'shipping_company', 'freight_carrier']
    },
    shipment_date: {
      name: 'shipment_date',
      label: 'Shipment Date',
      type: 'DATE',
      required: true,
      example: '2026-09-01',
      aliases: ['dispatch_date', 'shipping_date', 'shipped_at', 'date', 'dispatch_at']
    },
    quantity: {
      name: 'quantity',
      label: 'Quantity',
      type: 'NUMBER',
      required: false,
      defaultValue: 1,
      example: '100',
      aliases: ['qty', 'volume', 'units', 'package_count', 'pieces']
    },
    status: {
      name: 'status',
      label: 'Shipment Status',
      type: 'ENUM',
      required: false,
      enumValues: ['DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'DELAYED', 'CANCELLED'],
      defaultValue: 'DISPATCHED',
      aliases: ['shipment_status', 'delivery_status', 'state']
    }
  },
  duplicateRules: [
    {
      name: 'Shipment Reference Match',
      fields: ['shipment_reference'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 10. Register Purchase Orders Entity (Procurement)
entitySchemaRegistry.registerEntity({
  module: 'procurement',
  entity: 'purchase_orders',
  displayName: 'Purchase Orders',
  description: 'Procurement purchase orders, line items, supplier references, and totals',
  version: 1,
  fields: {
    po_number: {
      name: 'po_number',
      label: 'PO Number',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'PO-2026-8801',
      aliases: ['po_no', 'purchase_order_number', 'order_number', 'order_id']
    },
    vendor_name: {
      name: 'vendor_name',
      label: 'Supplier / Vendor Name',
      type: 'STRING',
      required: true,
      example: 'Acme Supply Co',
      aliases: ['vendor', 'supplier', 'supplier_name', 'company_name']
    },
    total_amount: {
      name: 'total_amount',
      label: 'Total PO Amount',
      type: 'DECIMAL',
      required: true,
      example: '12500.00',
      aliases: ['amount', 'total', 'po_amount', 'order_total']
    },
    order_date: {
      name: 'order_date',
      label: 'Order Date',
      type: 'DATE',
      required: true,
      example: '2026-09-15',
      aliases: ['date', 'po_date', 'issued_date']
    },
    status: {
      name: 'status',
      label: 'PO Status',
      type: 'ENUM',
      required: false,
      enumValues: ['DRAFT', 'APPROVED', 'SENT', 'FULFILLED', 'CANCELLED'],
      defaultValue: 'APPROVED',
      aliases: ['po_status', 'order_status', 'state']
    }
  },
  duplicateRules: [
    {
      name: 'PO Number Match',
      fields: ['po_number'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 11. Register Compliance Records Entity (Compliance)
entitySchemaRegistry.registerEntity({
  module: 'compliance',
  entity: 'compliance_records',
  displayName: 'Compliance Audit Records',
  description: 'Regulatory compliance filings, audit findings, and policy reviews',
  version: 1,
  fields: {
    audit_id: {
      name: 'audit_id',
      label: 'Audit Control ID',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'CMP-2026-091',
      aliases: ['record_id', 'compliance_id', 'audit_number', 'control_number']
    },
    policy_name: {
      name: 'policy_name',
      label: 'Policy Title',
      type: 'STRING',
      required: true,
      example: 'ISO 27001 Data Governance',
      aliases: ['policy', 'standard', 'regulation', 'title']
    },
    auditor: {
      name: 'auditor',
      label: 'Assigned Auditor',
      type: 'STRING',
      required: false,
      example: 'Compliance Board A',
      aliases: ['reviewer', 'inspector', 'assigned_to']
    },
    audit_date: {
      name: 'audit_date',
      label: 'Audit Date',
      type: 'DATE',
      required: true,
      example: '2026-08-20',
      aliases: ['date', 'review_date', 'filing_date']
    },
    status: {
      name: 'status',
      label: 'Compliance Status',
      type: 'ENUM',
      required: false,
      enumValues: ['COMPLIANT', 'NON_COMPLIANT', 'UNDER_REVIEW', 'ACTION_REQUIRED'],
      defaultValue: 'COMPLIANT',
      aliases: ['compliance_status', 'result', 'state']
    }
  },
  duplicateRules: [
    {
      name: 'Audit ID Match',
      fields: ['audit_id'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 12. Register Payments Entity (Finance)
entitySchemaRegistry.registerEntity({
  module: 'finance',
  entity: 'payments',
  displayName: 'Customer Payments',
  description: 'Payment receipts, bank reference numbers, payment methods, and ledger postings',
  version: 1,
  fields: {
    payment_reference: {
      name: 'payment_reference',
      label: 'Payment Reference',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'PAY-2026-901',
      aliases: ['payment_id', 'ref_no', 'transaction_id', 'trans_no', 'payment_no']
    },
    invoice_number: {
      name: 'invoice_number',
      label: 'Invoice Number',
      type: 'STRING',
      required: true,
      example: 'INV-2026-001',
      aliases: ['invoice_no', 'inv_number', 'bill_no']
    },
    amount: {
      name: 'amount',
      label: 'Payment Amount',
      type: 'DECIMAL',
      required: true,
      example: '1450.00',
      aliases: ['paid_amount', 'total_paid', 'value', 'payment_amount']
    },
    payment_date: {
      name: 'payment_date',
      label: 'Payment Date',
      type: 'DATE',
      required: true,
      example: '2026-09-20',
      aliases: ['date', 'paid_date', 'received_date']
    },
    payment_method: {
      name: 'payment_method',
      label: 'Payment Method',
      type: 'ENUM',
      required: false,
      enumValues: ['BANK_TRANSFER', 'CREDIT_CARD', 'CHEQUE', 'WIRE', 'CASH'],
      defaultValue: 'BANK_TRANSFER',
      aliases: ['method', 'type', 'mode']
    }
  },
  duplicateRules: [
    {
      name: 'Payment Reference Match',
      fields: ['payment_reference'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 13. Register Expenses Entity (Finance)
entitySchemaRegistry.registerEntity({
  module: 'finance',
  entity: 'expenses',
  displayName: 'Corporate Expenses',
  description: 'Employee expense claims, vendor reimbursements, and cost center allocations',
  version: 1,
  fields: {
    expense_id: {
      name: 'expense_id',
      label: 'Expense Record ID',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'EXP-9912',
      aliases: ['claim_id', 'expense_no', 'receipt_no']
    },
    employee_name: {
      name: 'employee_name',
      label: 'Employee Name',
      type: 'STRING',
      required: true,
      example: 'Jane Doe',
      aliases: ['claimant', 'employee', 'requested_by']
    },
    amount: {
      name: 'amount',
      label: 'Expense Amount',
      type: 'DECIMAL',
      required: true,
      example: '320.50',
      aliases: ['claim_amount', 'total', 'cost']
    },
    category: {
      name: 'category',
      label: 'Expense Category',
      type: 'STRING',
      required: true,
      example: 'Travel & Lodging',
      aliases: ['type', 'expense_type', 'cost_center']
    },
    expense_date: {
      name: 'expense_date',
      label: 'Expense Date',
      type: 'DATE',
      required: true,
      example: '2026-09-18',
      aliases: ['date', 'receipt_date', 'spent_date']
    }
  },
  duplicateRules: [
    {
      name: 'Expense ID Match',
      fields: ['expense_id'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 14. Register Attendance Entity (HR)
entitySchemaRegistry.registerEntity({
  module: 'hr',
  entity: 'attendance',
  displayName: 'Attendance Logs',
  description: 'Employee daily check-in times, shift hours, work location, and status',
  version: 1,
  fields: {
    log_id: {
      name: 'log_id',
      label: 'Attendance Log ID',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'ATT-2026-551',
      aliases: ['attendance_id', 'record_id', 'entry_id']
    },
    employee_id: {
      name: 'employee_id',
      label: 'Employee ID',
      type: 'STRING',
      required: true,
      example: 'EMP-1001',
      aliases: ['emp_id', 'staff_id', 'employee_code']
    },
    work_date: {
      name: 'work_date',
      label: 'Work Date',
      type: 'DATE',
      required: true,
      example: '2026-09-28',
      aliases: ['date', 'shift_date', 'entry_date']
    },
    hours_worked: {
      name: 'hours_worked',
      label: 'Hours Worked',
      type: 'DECIMAL',
      required: false,
      defaultValue: 8.0,
      example: '8.5',
      aliases: ['hours', 'total_hours', 'duration']
    }
  },
  duplicateRules: [
    {
      name: 'Attendance Log ID Match',
      fields: ['log_id'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 15. Register Payroll Entity (HR)
entitySchemaRegistry.registerEntity({
  module: 'hr',
  entity: 'payroll',
  displayName: 'Payroll Digest',
  description: 'Monthly compensation statements, tax withholdings, and net payout records',
  version: 1,
  fields: {
    payroll_id: {
      name: 'payroll_id',
      label: 'Payroll Statement ID',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'PAYROLL-2026-09',
      aliases: ['pay_id', 'statement_no', 'slip_id']
    },
    employee_id: {
      name: 'employee_id',
      label: 'Employee ID',
      type: 'STRING',
      required: true,
      example: 'EMP-1001',
      aliases: ['emp_id', 'staff_id']
    },
    net_salary: {
      name: 'net_salary',
      label: 'Net Salary',
      type: 'DECIMAL',
      required: true,
      example: '8500.00',
      aliases: ['net_pay', 'payout', 'amount', 'salary']
    },
    pay_period: {
      name: 'pay_period',
      label: 'Pay Period',
      type: 'STRING',
      required: true,
      example: '2026-09',
      aliases: ['month', 'period', 'cycle']
    }
  },
  duplicateRules: [
    {
      name: 'Payroll ID Match',
      fields: ['payroll_id'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 16. Register Deals Entity (Sales)
entitySchemaRegistry.registerEntity({
  module: 'sales',
  entity: 'deals',
  displayName: 'Sales Deals & Opportunities',
  description: 'Sales pipeline opportunities, expected deal value, target close date, and pipeline stage',
  version: 1,
  fields: {
    deal_id: {
      name: 'deal_id',
      label: 'Deal ID',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'DEAL-2026-101',
      aliases: ['opportunity_id', 'deal_no', 'opp_id']
    },
    deal_name: {
      name: 'deal_name',
      label: 'Deal Title',
      type: 'STRING',
      required: true,
      example: 'Enterprise License Expansion',
      aliases: ['title', 'opportunity_name', 'name']
    },
    amount: {
      name: 'amount',
      label: 'Deal Value',
      type: 'DECIMAL',
      required: true,
      example: '45000.00',
      aliases: ['value', 'deal_value', 'revenue']
    },
    stage: {
      name: 'stage',
      label: 'Pipeline Stage',
      type: 'ENUM',
      required: false,
      enumValues: ['PROSPECT', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'],
      defaultValue: 'PROSPECT',
      aliases: ['pipeline_stage', 'status', 'state']
    }
  },
  duplicateRules: [
    {
      name: 'Deal ID Match',
      fields: ['deal_id'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 17. Register Work Orders Entity (Manufacturing)
entitySchemaRegistry.registerEntity({
  module: 'manufacturing',
  entity: 'work_orders',
  displayName: 'Manufacturing Work Orders',
  description: 'Factory production orders, plant assembly lines, target output quantities, and schedule dates',
  version: 1,
  fields: {
    work_order_id: {
      name: 'work_order_id',
      label: 'Work Order ID',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'WO-MFG-8812',
      aliases: ['wo_number', 'order_id', 'production_id']
    },
    product_sku: {
      name: 'product_sku',
      label: 'Product SKU',
      type: 'STRING',
      required: true,
      example: 'PROD-1001',
      aliases: ['sku', 'item_code', 'part_no']
    },
    target_quantity: {
      name: 'target_quantity',
      label: 'Target Output Quantity',
      type: 'NUMBER',
      required: true,
      example: '500',
      aliases: ['qty', 'planned_quantity', 'units']
    },
    plant_code: {
      name: 'plant_code',
      label: 'Manufacturing Plant',
      type: 'STRING',
      required: false,
      defaultValue: 'PLANT-NORTH-1',
      example: 'PLANT-NORTH-1'
    }
  },
  duplicateRules: [
    {
      name: 'Work Order ID Match',
      fields: ['work_order_id'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 18. Register Enterprise Assets Entity (Assets)
entitySchemaRegistry.registerEntity({
  module: 'assets',
  entity: 'enterprise_assets',
  displayName: 'Fixed Enterprise Assets',
  description: 'Corporate equipment registry, serial identifiers, acquisition cost, and location',
  version: 1,
  fields: {
    asset_tag: {
      name: 'asset_tag',
      label: 'Asset Tag Number',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'AST-SERVER-4091',
      aliases: ['asset_id', 'serial_number', 'tag_id', 'barcode']
    },
    asset_name: {
      name: 'asset_name',
      label: 'Asset Description',
      type: 'STRING',
      required: true,
      example: 'Dell PowerEdge R750 Server',
      aliases: ['description', 'title', 'name']
    },
    purchase_cost: {
      name: 'purchase_cost',
      label: 'Acquisition Cost',
      type: 'DECIMAL',
      required: true,
      example: '12500.00',
      aliases: ['cost', 'value', 'price']
    },
    location: {
      name: 'location',
      label: 'Asset Location',
      type: 'STRING',
      required: false,
      example: 'Data Center Row 4',
      aliases: ['site', 'office', 'room']
    }
  },
  duplicateRules: [
    {
      name: 'Asset Tag Match',
      fields: ['asset_tag'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 19. Register IT Tickets Entity (ITSM)
entitySchemaRegistry.registerEntity({
  module: 'itsm',
  entity: 'it_tickets',
  displayName: 'IT Service Tickets',
  description: 'Helpdesk service tickets, hardware/software issues, urgency level, and resolution state',
  version: 1,
  fields: {
    ticket_id: {
      name: 'ticket_id',
      label: 'Ticket ID',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'INC-2026-9901',
      aliases: ['incident_id', 'issue_id', 'ticket_no']
    },
    subject: {
      name: 'subject',
      label: 'Issue Summary',
      type: 'STRING',
      required: true,
      example: 'VPN Connection Failure',
      aliases: ['title', 'summary', 'description']
    },
    requested_by: {
      name: 'requested_by',
      label: 'Requester Email',
      type: 'EMAIL',
      required: true,
      example: 'john.smith@company.com',
      aliases: ['email', 'requester', 'user_email']
    },
    priority: {
      name: 'priority',
      label: 'Ticket Priority',
      type: 'ENUM',
      required: false,
      enumValues: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      defaultValue: 'MEDIUM',
      aliases: ['urgency', 'severity']
    }
  },
  duplicateRules: [
    {
      name: 'Ticket ID Match',
      fields: ['ticket_id'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 20. Register Legal Contracts Entity (Legal)
entitySchemaRegistry.registerEntity({
  module: 'legal',
  entity: 'legal_contracts',
  displayName: 'Legal Contracts & NDAs',
  description: 'Corporate commercial agreements, non-disclosure terms, counterparty details, and expiration',
  version: 1,
  fields: {
    contract_number: {
      name: 'contract_number',
      label: 'Contract Number',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'CTR-2026-0812',
      aliases: ['contract_id', 'ref_no', 'agreement_id']
    },
    title: {
      name: 'title',
      label: 'Agreement Title',
      type: 'STRING',
      required: true,
      example: 'Master Services Agreement',
      aliases: ['contract_title', 'name']
    },
    counterparty: {
      name: 'counterparty',
      label: 'Counterparty Organization',
      type: 'STRING',
      required: true,
      example: 'Global Tech Solutions LLC',
      aliases: ['vendor', 'client', 'partner', 'party_b']
    },
    effective_date: {
      name: 'effective_date',
      label: 'Effective Date',
      type: 'DATE',
      required: true,
      example: '2026-01-01',
      aliases: ['start_date', 'signed_date']
    }
  },
  duplicateRules: [
    {
      name: 'Contract Number Match',
      fields: ['contract_number'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 21. Register Marketing Campaigns Entity (Marketing)
entitySchemaRegistry.registerEntity({
  module: 'marketing',
  entity: 'marketing_campaigns',
  displayName: 'Marketing Campaigns',
  description: 'Digital marketing initiatives, campaign budget allocations, target channels, and conversions',
  version: 1,
  fields: {
    campaign_code: {
      name: 'campaign_code',
      label: 'Campaign Code',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'CMPG-Q3-CLOUD',
      aliases: ['campaign_id', 'code', 'ref_code']
    },
    campaign_name: {
      name: 'campaign_name',
      label: 'Campaign Name',
      type: 'STRING',
      required: true,
      example: 'Q3 Enterprise Cloud Promotion',
      aliases: ['title', 'name']
    },
    budget: {
      name: 'budget',
      label: 'Allocated Budget',
      type: 'DECIMAL',
      required: true,
      example: '25000.00',
      aliases: ['allocated_budget', 'spend', 'cost']
    },
    channel: {
      name: 'channel',
      label: 'Marketing Channel',
      type: 'STRING',
      required: false,
      defaultValue: 'Digital Search',
      example: 'LinkedIn Ads',
      aliases: ['medium', 'platform']
    }
  },
  duplicateRules: [
    {
      name: 'Campaign Code Match',
      fields: ['campaign_code'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

// 22. Register Facility Tickets Entity (Operations)
entitySchemaRegistry.registerEntity({
  module: 'operations',
  entity: 'facility_tickets',
  displayName: 'Facility Maintenance Tickets',
  description: 'Corporate workplace tickets, maintenance requests, building locations, and status',
  version: 1,
  fields: {
    facility_ticket_id: {
      name: 'facility_ticket_id',
      label: 'Facility Ticket ID',
      type: 'IDENTIFIER',
      required: true,
      unique: true,
      example: 'FAC-2026-1092',
      aliases: ['ticket_id', 'req_id', 'work_order_no']
    },
    location: {
      name: 'location',
      label: 'Building / Office Location',
      type: 'STRING',
      required: true,
      example: 'Headquarters Floor 3',
      aliases: ['building', 'office', 'site']
    },
    description: {
      name: 'description',
      label: 'Issue Description',
      type: 'STRING',
      required: true,
      example: 'HVAC Temperature Control Adjustment',
      aliases: ['issue', 'summary', 'title']
    },
    status: {
      name: 'status',
      label: 'Status',
      type: 'ENUM',
      required: false,
      enumValues: ['SUBMITTED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      defaultValue: 'SUBMITTED',
      aliases: ['state', 'ticket_status']
    }
  },
  duplicateRules: [
    {
      name: 'Facility Ticket ID Match',
      fields: ['facility_ticket_id'],
      strategy: 'EXACT_MATCH',
      isDefault: true
    }
  ]
});

