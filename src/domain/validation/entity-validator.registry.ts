/**
 * Entity Business Validator Registry (Tier 4)
 * Provides an extension point for entity-specific domain validation rules
 */

import { EntitySchemaDefinition } from '../../core/registry/entity-schema.registry.js';
import {
  FieldValidationIssue,
  IBusinessValidator,
  ValidationContext
} from '../../core/types/validation.types.js';

export class ContactsBusinessValidator implements IBusinessValidator {
  public readonly name = 'CONTACTS_BUSINESS_VALIDATOR';
  public readonly entity = 'contacts';

  public validate(
    row: Record<string, unknown>,
    _schema: EntitySchemaDefinition,
    _context: ValidationContext
  ): FieldValidationIssue[] {
    const issues: FieldValidationIssue[] = [];

    // Rule: Warning if both email and phone are missing (though email is schema-required)
    if (!row['email'] && !row['phone']) {
      issues.push({
        field: 'email',
        code: 'MISSING_CONTACT_METHOD',
        severity: 'WARNING',
        message: 'Contact record has neither email nor phone number'
      });
    }

    return issues;
  }
}

export class ProductsBusinessValidator implements IBusinessValidator {
  public readonly name = 'PRODUCTS_BUSINESS_VALIDATOR';
  public readonly entity = 'products';

  public validate(
    row: Record<string, unknown>,
    _schema: EntitySchemaDefinition,
    _context: ValidationContext
  ): FieldValidationIssue[] {
    const issues: FieldValidationIssue[] = [];

    if (row['price'] !== undefined && row['price'] !== null) {
      const price = Number(row['price']);
      if (price < 0) {
        issues.push({
          field: 'price',
          code: 'NEGATIVE_PRICE',
          severity: 'ERROR',
          message: 'Product price cannot be negative',
          transformedValue: price
        });
      }
    }

    if (row['stock_quantity'] !== undefined && row['stock_quantity'] !== null) {
      const qty = Number(row['stock_quantity']);
      if (qty < 0) {
        issues.push({
          field: 'stock_quantity',
          code: 'NEGATIVE_STOCK',
          severity: 'ERROR',
          message: 'Stock quantity cannot be negative',
          transformedValue: qty
        });
      }
    }

    return issues;
  }
}

export class InvoicesBusinessValidator implements IBusinessValidator {
  public readonly name = 'INVOICES_BUSINESS_VALIDATOR';
  public readonly entity = 'invoices';

  public validate(
    row: Record<string, unknown>,
    _schema: EntitySchemaDefinition,
    _context: ValidationContext
  ): FieldValidationIssue[] {
    const issues: FieldValidationIssue[] = [];

    if (row['total_amount'] !== undefined && row['total_amount'] !== null) {
      const amount = Number(row['total_amount']);
      if (amount < 0) {
        issues.push({
          field: 'total_amount',
          code: 'NEGATIVE_INVOICE_TOTAL',
          severity: 'ERROR',
          message: 'Invoice total amount cannot be negative',
          transformedValue: amount
        });
      } else if (amount > 100000) {
        issues.push({
          field: 'total_amount',
          code: 'HIGH_VALUE_INVOICE',
          severity: 'WARNING',
          message: `Invoice total amount (${amount}) exceeds threshold (100,000) and requires review`,
          transformedValue: amount
        });
      }
    }

    return issues;
  }
}

export class EntityValidatorRegistry {
  private validators: Map<string, IBusinessValidator[]> = new Map();

  constructor() {
    this.registerDefaults();
  }

  public register(validator: IBusinessValidator): void {
    const key = validator.entity.toLowerCase();
    const existing = this.validators.get(key) || [];
    existing.push(validator);
    this.validators.set(key, existing);
  }

  public getValidatorsForEntity(entity: string): IBusinessValidator[] {
    if (!entity) return [];
    return this.validators.get(entity.toLowerCase()) || [];
  }

  private registerDefaults(): void {
    this.register(new ContactsBusinessValidator());
    this.register(new ProductsBusinessValidator());
    this.register(new InvoicesBusinessValidator());
  }
}

export const entityValidatorRegistry = new EntityValidatorRegistry();
