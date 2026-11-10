/**
 * Tier 2 Field-Level Validators
 */

import { EntityFieldDefinition } from '../../core/registry/entity-schema.registry.js';
import {
  FieldValidationIssue,
  IFieldValidator,
  ValidationContext
} from '../../core/types/validation.types.js';

export class RequiredValidator implements IFieldValidator {
  public readonly name = 'REQUIRED_VALIDATOR';
  private static readonly PLACEHOLDERS = new Set(['n/a', 'na', 'null', '-', 'unknown', 'none']);

  public validate(
    value: unknown,
    fieldDef: EntityFieldDefinition,
    _context: ValidationContext
  ): FieldValidationIssue[] {
    if (!fieldDef.required || fieldDef.readOnly) return [];

    if (value === null || value === undefined || value === '' || (typeof value === 'string' && value.trim() === '')) {
      return [
        {
          field: fieldDef.name,
          code: 'MISSING_REQUIRED_FIELD',
          severity: 'ERROR',
          message: `Field '${fieldDef.label}' (${fieldDef.name}) is required and cannot be empty`,
          sourceValue: 'EMPTY',
          transformedValue: value,
          details: { action: `Enter a value for required field '${fieldDef.label}'.`, expectedFormat: fieldDef.format || `Valid ${fieldDef.type} value`, autoCorrected: false }
        }
      ];
    }

    if (typeof value === 'string' && RequiredValidator.PLACEHOLDERS.has(value.trim().toLowerCase())) {
      return [
        {
          field: fieldDef.name,
          code: 'INVALID_PLACEHOLDER',
          severity: 'ERROR',
          message: `Value '${value}' is an unnormalized placeholder for required field '${fieldDef.label}'`,
          sourceValue: value,
          transformedValue: value,
          details: { action: `Replace the placeholder with the real value for '${fieldDef.label}'.`, expectedFormat: fieldDef.format || `Valid ${fieldDef.type} value`, autoCorrected: false }
        }
      ];
    }

    return [];
  }
}

export class OptionalFieldValidator implements IFieldValidator {
  public readonly name = 'OPTIONAL_FIELD_VALIDATOR';
  private static readonly PLACEHOLDERS = new Set(['n/a', 'na', 'null', '-', 'unknown', 'none']);

  public validate(
    value: unknown,
    fieldDef: EntityFieldDefinition,
    _context: ValidationContext
  ): FieldValidationIssue[] {
    if (fieldDef.required || fieldDef.readOnly) return [];

    if (value === null || value === undefined || value === '' || (typeof value === 'string' && value.trim() === '')) {
      return [
        {
          field: fieldDef.name,
          code: 'OPTIONAL_FIELD_MISSING',
          severity: 'WARNING',
          message: `Optional field '${fieldDef.label}' (${fieldDef.name}) is missing`,
          sourceValue: 'EMPTY',
          transformedValue: value
        }
      ];
    }

    if (typeof value === 'string' && OptionalFieldValidator.PLACEHOLDERS.has(value.trim().toLowerCase())) {
      return [
        {
          field: fieldDef.name,
          code: 'INVALID_PLACEHOLDER',
          severity: 'WARNING',
          message: `Value '${value}' is a placeholder for optional field '${fieldDef.label}'`,
          sourceValue: value,
          transformedValue: value
        }
      ];
    }

    return [];
  }
}

export class DataTypeValidator implements IFieldValidator {
  public readonly name = 'DATA_TYPE_VALIDATOR';

  public validate(
    value: unknown,
    fieldDef: EntityFieldDefinition,
    _context: ValidationContext
  ): FieldValidationIssue[] {
    if (value === null || value === undefined || value === '') return [];

    switch (fieldDef.type) {
      case 'NUMBER':
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          return [
            {
              field: fieldDef.name,
              code: 'INVALID_INTEGER',
              severity: 'ERROR',
              message: `This value is not a valid whole number for '${fieldDef.label}'. Enter a number such as 1250 or 42; the system cannot safely guess what the current value means.`,
              transformedValue: value,
              details: { action: `Enter a valid whole number in '${fieldDef.label}'.`, expectedFormat: 'Example: 1250', autoCorrected: false }
            }
          ];
        }
        break;

      case 'DECIMAL':
        if (typeof value !== 'number' || isNaN(value) || !Number.isFinite(value)) {
          return [
            {
              field: fieldDef.name,
              code: 'INVALID_DECIMAL',
              severity: 'ERROR',
              message: `This value is not a valid decimal number for '${fieldDef.label}'. Enter a numeric value such as 1250.50; letters or ambiguous text cannot be guessed safely.`,
              transformedValue: value,
              details: { action: `Enter a valid decimal number in '${fieldDef.label}'.`, expectedFormat: 'Example: 1250.50', autoCorrected: false }
            }
          ];
        }
        break;

      case 'BOOLEAN':
        if (typeof value !== 'boolean') {
          return [
            {
              field: fieldDef.name,
              code: 'INVALID_BOOLEAN',
              severity: 'ERROR',
              message: `This value is not a valid boolean for '${fieldDef.label}'. Choose true or false (or the configured equivalent values).`,
              transformedValue: value,
              details: { action: `Enter true or false for '${fieldDef.label}'.`, expectedFormat: 'true / false', autoCorrected: false }
            }
          ];
        }
        break;

      case 'DATE':
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return [
            {
              field: fieldDef.name,
              code: 'INVALID_DATE_FORMAT',
              severity: 'ERROR',
              message: `This value is not a valid date for '${fieldDef.label}'. Enter an unambiguous date in YYYY-MM-DD format, for example 2026-09-28.`,
              transformedValue: value,
              details: { action: `Enter a valid date for '${fieldDef.label}'.`, expectedFormat: 'YYYY-MM-DD (example: 2026-09-28)', autoCorrected: false }
            }
          ];
        }
        break;
    }

    return [];
  }
}

export class EnumValidator implements IFieldValidator {
  public readonly name = 'ENUM_VALIDATOR';

  public validate(
    value: unknown,
    fieldDef: EntityFieldDefinition,
    _context: ValidationContext
  ): FieldValidationIssue[] {
    if (value === null || value === undefined || value === '') return [];
    if (fieldDef.type !== 'ENUM' || !fieldDef.enumValues) return [];

    const strVal = String(value).trim();
    if (!fieldDef.enumValues.includes(strVal)) {
      return [
        {
          field: fieldDef.name,
          code: 'INVALID_ENUM_VALUE',
          severity: 'ERROR',
          message: `Value '${strVal}' is not valid for '${fieldDef.label}'. Allowed values: ${fieldDef.enumValues.join(', ')}`,
          transformedValue: value,
          details: { allowedValues: fieldDef.enumValues, action: `Choose one of the allowed values for ${fieldDef.label}.`, autoCorrected: false }
        }
      ];
    }

    return [];
  }
}

export class EmailValidator implements IFieldValidator {
  public readonly name = 'EMAIL_VALIDATOR';
  private static readonly EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  public validate(
    value: unknown,
    fieldDef: EntityFieldDefinition,
    _context: ValidationContext
  ): FieldValidationIssue[] {
    if (value === null || value === undefined || value === '') return [];
    if (fieldDef.type !== 'EMAIL') return [];

    const str = String(value).trim();
    if (!EmailValidator.EMAIL_REGEX.test(str)) {
      return [
        {
          field: fieldDef.name,
          code: 'INVALID_EMAIL_FORMAT',
          severity: 'ERROR',
          message: `This value is not a valid email address. Enter an address such as name@company.com.`,
          transformedValue: value,
          details: { action: `Enter a valid email address for '${fieldDef.label}'.`, expectedFormat: 'name@company.com', autoCorrected: false }
        }
      ];
    }

    return [];
  }
}

export class PhoneValidator implements IFieldValidator {
  public readonly name = 'PHONE_VALIDATOR';

  public validate(
    value: unknown,
    fieldDef: EntityFieldDefinition,
    _context: ValidationContext
  ): FieldValidationIssue[] {
    if (value === null || value === undefined || value === '') return [];
    if (fieldDef.type !== 'PHONE') return [];

    const str = String(value).trim();
    const digits = str.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return [
        {
          field: fieldDef.name,
          code: 'INVALID_PHONE_NUMBER',
          severity: 'WARNING',
          message: `This phone number has ${digits.length} digits. Enter a phone number containing 7-15 digits, for example +91 9000000001.`,
          transformedValue: value,
          details: { action: `Review and enter a valid phone number for '${fieldDef.label}'.`, expectedFormat: '7-15 digits; example +91 9000000001', autoCorrected: false }
        }
      ];
    }

    return [];
  }
}

export class StringConstraintValidator implements IFieldValidator {
  public readonly name = 'STRING_CONSTRAINT_VALIDATOR';

  public validate(
    value: unknown,
    fieldDef: EntityFieldDefinition,
    _context: ValidationContext
  ): FieldValidationIssue[] {
    if (value === null || value === undefined || value === '') return [];
    if (typeof value !== 'string') return [];

    const issues: FieldValidationIssue[] = [];
    const constraints = fieldDef.constraints;
    if (!constraints) return issues;

    if (constraints.minLength !== undefined && value.length < constraints.minLength) {
      issues.push({
        field: fieldDef.name,
        code: 'MIN_LENGTH_VIOLATION',
        severity: 'ERROR',
        message: `Field '${fieldDef.label}' length (${value.length}) is less than minimum required (${constraints.minLength})`,
        transformedValue: value
      });
    }

    if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
      issues.push({
        field: fieldDef.name,
        code: 'MAX_LENGTH_VIOLATION',
        severity: 'ERROR',
        message: `Field '${fieldDef.label}' length (${value.length}) exceeds maximum allowed (${constraints.maxLength})`,
        transformedValue: value
      });
    }

    if (constraints.pattern) {
      try {
        const regex = new RegExp(constraints.pattern);
        if (!regex.test(value)) {
          issues.push({
            field: fieldDef.name,
            code: 'PATTERN_MISMATCH',
            severity: 'ERROR',
            message: `This value does not match the required format for '${fieldDef.label}'. Enter a value that follows the configured field format.`,
            transformedValue: value,
            details: { action: `Correct the value so it matches the configured format for '${fieldDef.label}'.`, expectedFormat: constraints.pattern, autoCorrected: false }
          });
        }
      } catch (err) {
        // Safe regex failure handling
      }
    }

    return issues;
  }
}

export class NumericRangeValidator implements IFieldValidator {
  public readonly name = 'NUMERIC_RANGE_VALIDATOR';

  public validate(
    value: unknown,
    fieldDef: EntityFieldDefinition,
    _context: ValidationContext
  ): FieldValidationIssue[] {
    if (value === null || value === undefined || value === '') return [];
    if (typeof value !== 'number') return [];

    const issues: FieldValidationIssue[] = [];
    const constraints = fieldDef.constraints;
    if (!constraints) return issues;

    if (constraints.min !== undefined && value < constraints.min) {
      issues.push({
        field: fieldDef.name,
        code: 'MIN_VALUE_VIOLATION',
        severity: 'ERROR',
        message: `Field '${fieldDef.label}' value (${value}) is below minimum allowed (${constraints.min})`,
        transformedValue: value
      });
    }

    if (constraints.max !== undefined && value > constraints.max) {
      issues.push({
        field: fieldDef.name,
        code: 'MAX_VALUE_VIOLATION',
        severity: 'ERROR',
        message: `Field '${fieldDef.label}' value (${value}) exceeds maximum allowed (${constraints.max})`,
        transformedValue: value
      });
    }

    return issues;
  }
}
