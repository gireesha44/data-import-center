/**
 * Entity Business Validator Registry (Tier 4)
 * Provides an extension point for entity-specific domain validation rules
 */
import { EntitySchemaDefinition } from '../../core/registry/entity-schema.registry.js';
import { FieldValidationIssue, IBusinessValidator, ValidationContext } from '../../core/types/validation.types.js';
export declare class ContactsBusinessValidator implements IBusinessValidator {
    readonly name = "CONTACTS_BUSINESS_VALIDATOR";
    readonly entity = "contacts";
    validate(row: Record<string, unknown>, _schema: EntitySchemaDefinition, _context: ValidationContext): FieldValidationIssue[];
}
export declare class ProductsBusinessValidator implements IBusinessValidator {
    readonly name = "PRODUCTS_BUSINESS_VALIDATOR";
    readonly entity = "products";
    validate(row: Record<string, unknown>, _schema: EntitySchemaDefinition, _context: ValidationContext): FieldValidationIssue[];
}
export declare class InvoicesBusinessValidator implements IBusinessValidator {
    readonly name = "INVOICES_BUSINESS_VALIDATOR";
    readonly entity = "invoices";
    validate(row: Record<string, unknown>, _schema: EntitySchemaDefinition, _context: ValidationContext): FieldValidationIssue[];
}
export declare class EntityValidatorRegistry {
    private validators;
    constructor();
    register(validator: IBusinessValidator): void;
    getValidatorsForEntity(entity: string): IBusinessValidator[];
    private registerDefaults;
}
export declare const entityValidatorRegistry: EntityValidatorRegistry;
//# sourceMappingURL=entity-validator.registry.d.ts.map