import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RequiredValidator,
  DataTypeValidator,
  EnumValidator,
  EmailValidator,
  PhoneValidator,
  StringConstraintValidator,
  NumericRangeValidator
} from '../../../domain/validation/field-validators.js';

describe('Tier 2 Field Validators', () => {
  const context = {
    organizationId: 'org_1',
    importId: 'imp_1',
    targetEntity: 'contacts',
    rowIndex: 1,
    rawData: {},
    transformedData: {},
    schema: {
      module: 'crm',
      entity: 'contacts',
      displayName: 'Contacts',
      version: 1,
      fields: {},
      duplicateRules: []
    }
  };

  describe('RequiredValidator', () => {
    const validator = new RequiredValidator();

    it('flags null or empty string when field is required', () => {
      const fieldDef = { name: 'email', label: 'Email', type: 'EMAIL' as const, required: true };
      const issues1 = validator.validate(null, fieldDef, context);
      assert.equal(issues1.length, 1);
      assert.equal(issues1[0].code, 'MISSING_REQUIRED_FIELD');
      assert.equal(issues1[0].severity, 'ERROR');

      const issues2 = validator.validate('', fieldDef, context);
      assert.equal(issues2.length, 1);
    });

    it('passes when value is present or field is optional', () => {
      const fieldDef = { name: 'email', label: 'Email', type: 'EMAIL' as const, required: true };
      assert.equal(validator.validate('jane@example.com', fieldDef, context).length, 0);

      const optionalField = { name: 'phone', label: 'Phone', type: 'PHONE' as const, required: false };
      assert.equal(validator.validate(null, optionalField, context).length, 0);
    });
  });

  describe('DataTypeValidator', () => {
    const validator = new DataTypeValidator();

    it('validates numbers and booleans', () => {
      const numField = { name: 'age', label: 'Age', type: 'NUMBER' as const, required: false };
      assert.equal(validator.validate(25, numField, context).length, 0);
      assert.equal(validator.validate(NaN, numField, context).length, 1);
      assert.equal(validator.validate('not-num', numField, context).length, 1);

      const boolField = { name: 'isActive', label: 'Active', type: 'BOOLEAN' as const, required: false };
      assert.equal(validator.validate(true, boolField, context).length, 0);
      assert.equal(validator.validate('yes', boolField, context).length, 1);
    });

    it('validates dates', () => {
      const dateField = { name: 'dob', label: 'DOB', type: 'DATE' as const, required: false };
      assert.equal(validator.validate('2026-05-15', dateField, context).length, 0);
      assert.equal(validator.validate('invalid-date', dateField, context).length, 1);
    });
  });

  describe('EnumValidator', () => {
    const validator = new EnumValidator();
    const enumField = {
      name: 'status',
      label: 'Status',
      type: 'ENUM' as const,
      required: false,
      enumValues: ['ACTIVE', 'INACTIVE', 'PENDING']
    };

    it('passes on valid enum values and fails on invalid enum values', () => {
      assert.equal(validator.validate('ACTIVE', enumField, context).length, 0);
      const issues = validator.validate('UNKNOWN_STATUS', enumField, context);
      assert.equal(issues.length, 1);
      assert.equal(issues[0].code, 'INVALID_ENUM_VALUE');
    });
  });

  describe('EmailValidator & PhoneValidator', () => {
    it('validates standard email syntax', () => {
      const emailValidator = new EmailValidator();
      const emailField = { name: 'email', label: 'Email', type: 'EMAIL' as const, required: false };

      assert.equal(emailValidator.validate('valid.email@example.com', emailField, context).length, 0);
      assert.equal(emailValidator.validate('missing-at-sign', emailField, context).length, 1);
      assert.equal(emailValidator.validate('bad@domain', emailField, context).length, 1);
    });

    it('validates phone numbers', () => {
      const phoneValidator = new PhoneValidator();
      const phoneField = { name: 'phone', label: 'Phone', type: 'PHONE' as const, required: false };

      assert.equal(phoneValidator.validate('+15551234567', phoneField, context).length, 0);
      assert.equal(phoneValidator.validate('1234567890', phoneField, context).length, 0);
      assert.equal(phoneValidator.validate('12', phoneField, context).length, 1);
    });
  });

  describe('StringConstraintValidator & NumericRangeValidator', () => {
    it('enforces min/max length and regex', () => {
      const strValidator = new StringConstraintValidator();
      const strField = {
        name: 'code',
        label: 'Code',
        type: 'STRING' as const,
        required: false,
        constraints: {
          minLength: 3,
          maxLength: 6,
          pattern: '^[A-Z0-9]+$'
        }
      };

      assert.equal(strValidator.validate('AB12', strField, context).length, 0);
      assert.equal(strValidator.validate('A', strField, context).length, 1);
      assert.equal(strValidator.validate('TOOLONG123', strField, context).length, 1);
      assert.equal(strValidator.validate('ab-12', strField, context).length, 1);
    });

    it('enforces min/max numeric ranges', () => {
      const numValidator = new NumericRangeValidator();
      const numField = {
        name: 'score',
        label: 'Score',
        type: 'NUMBER' as const,
        required: false,
        constraints: { min: 0, max: 100 }
      };

      assert.equal(numValidator.validate(50, numField, context).length, 0);
      assert.equal(numValidator.validate(-5, numField, context).length, 1);
      assert.equal(numValidator.validate(150, numField, context).length, 1);
    });
  });
});
