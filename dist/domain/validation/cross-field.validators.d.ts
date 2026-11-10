/**
 * Tier 3 Cross-Field Validators
 */
import { EntitySchemaDefinition } from '../../core/registry/entity-schema.registry.js';
import { FieldValidationIssue, ICrossFieldValidator, ValidationContext } from '../../core/types/validation.types.js';
export declare class DateRangeCrossFieldValidator implements ICrossFieldValidator {
    readonly name = "DATE_RANGE_CROSS_FIELD_VALIDATOR";
    validate(row: Record<string, unknown>, _schema: EntitySchemaDefinition, _context: ValidationContext): FieldValidationIssue[];
}
//# sourceMappingURL=cross-field.validators.d.ts.map