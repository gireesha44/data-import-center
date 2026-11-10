/**
 * Tier 2 Field-Level Validators
 */
import { EntityFieldDefinition } from '../../core/registry/entity-schema.registry.js';
import { FieldValidationIssue, IFieldValidator, ValidationContext } from '../../core/types/validation.types.js';
export declare class RequiredValidator implements IFieldValidator {
    readonly name = "REQUIRED_VALIDATOR";
    private static readonly PLACEHOLDERS;
    validate(value: unknown, fieldDef: EntityFieldDefinition, _context: ValidationContext): FieldValidationIssue[];
}
export declare class OptionalFieldValidator implements IFieldValidator {
    readonly name = "OPTIONAL_FIELD_VALIDATOR";
    private static readonly PLACEHOLDERS;
    validate(value: unknown, fieldDef: EntityFieldDefinition, _context: ValidationContext): FieldValidationIssue[];
}
export declare class DataTypeValidator implements IFieldValidator {
    readonly name = "DATA_TYPE_VALIDATOR";
    validate(value: unknown, fieldDef: EntityFieldDefinition, _context: ValidationContext): FieldValidationIssue[];
}
export declare class EnumValidator implements IFieldValidator {
    readonly name = "ENUM_VALIDATOR";
    validate(value: unknown, fieldDef: EntityFieldDefinition, _context: ValidationContext): FieldValidationIssue[];
}
export declare class EmailValidator implements IFieldValidator {
    readonly name = "EMAIL_VALIDATOR";
    private static readonly EMAIL_REGEX;
    validate(value: unknown, fieldDef: EntityFieldDefinition, _context: ValidationContext): FieldValidationIssue[];
}
export declare class PhoneValidator implements IFieldValidator {
    readonly name = "PHONE_VALIDATOR";
    validate(value: unknown, fieldDef: EntityFieldDefinition, _context: ValidationContext): FieldValidationIssue[];
}
export declare class StringConstraintValidator implements IFieldValidator {
    readonly name = "STRING_CONSTRAINT_VALIDATOR";
    validate(value: unknown, fieldDef: EntityFieldDefinition, _context: ValidationContext): FieldValidationIssue[];
}
export declare class NumericRangeValidator implements IFieldValidator {
    readonly name = "NUMERIC_RANGE_VALIDATOR";
    validate(value: unknown, fieldDef: EntityFieldDefinition, _context: ValidationContext): FieldValidationIssue[];
}
//# sourceMappingURL=field-validators.d.ts.map