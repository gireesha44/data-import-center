/**
 * Entity Business Validator Registry (Tier 4)
 * Provides an extension point for entity-specific domain validation rules
 */
export class ContactsBusinessValidator {
    name = 'CONTACTS_BUSINESS_VALIDATOR';
    entity = 'contacts';
    validate(row, _schema, _context) {
        const issues = [];
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
export class ProductsBusinessValidator {
    name = 'PRODUCTS_BUSINESS_VALIDATOR';
    entity = 'products';
    validate(row, _schema, _context) {
        const issues = [];
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
export class InvoicesBusinessValidator {
    name = 'INVOICES_BUSINESS_VALIDATOR';
    entity = 'invoices';
    validate(row, _schema, _context) {
        const issues = [];
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
            }
            else if (amount > 100000) {
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
    validators = new Map();
    constructor() {
        this.registerDefaults();
    }
    register(validator) {
        const key = validator.entity.toLowerCase();
        const existing = this.validators.get(key) || [];
        existing.push(validator);
        this.validators.set(key, existing);
    }
    getValidatorsForEntity(entity) {
        if (!entity)
            return [];
        return this.validators.get(entity.toLowerCase()) || [];
    }
    registerDefaults() {
        this.register(new ContactsBusinessValidator());
        this.register(new ProductsBusinessValidator());
        this.register(new InvoicesBusinessValidator());
    }
}
export const entityValidatorRegistry = new EntityValidatorRegistry();
//# sourceMappingURL=entity-validator.registry.js.map