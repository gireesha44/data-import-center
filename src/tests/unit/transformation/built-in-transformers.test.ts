import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TrimTransformer,
  LowercaseTransformer,
  UppercaseTransformer,
  NullNormalizeTransformer,
  ToNumberTransformer,
  ToDecimalTransformer,
  ToBooleanTransformer,
  ToDateTransformer,
  ToDateTimeTransformer,
  PhoneFormatTransformer,
  PrefixSuffixTransformer,
  DefaultValueTransformer
} from '../../../domain/transformation/built-in.transformers.js';

describe('Built-in Transformers', () => {
  describe('TrimTransformer', () => {
    const transformer = new TrimTransformer();

    it('trims leading and trailing whitespace', () => {
      assert.equal(transformer.execute('  hello world  '), 'hello world');
      assert.equal(transformer.execute('\t\n test \r\n'), 'test');
    });

    it('handles non-string values gracefully', () => {
      assert.equal(transformer.execute(123), 123);
      assert.equal(transformer.execute(null), null);
      assert.equal(transformer.execute(undefined), undefined);
    });
  });

  describe('Lowercase & Uppercase Transformers', () => {
    it('converts text case correctly', () => {
      const lower = new LowercaseTransformer();
      const upper = new UppercaseTransformer();

      assert.equal(lower.execute('John.Doe@EXAMPLE.COM'), 'john.doe@example.com');
      assert.equal(upper.execute('eur'), 'EUR');
      assert.equal(lower.execute(null), null);
    });
  });

  describe('NullNormalizeTransformer', () => {
    const transformer = new NullNormalizeTransformer();

    it('converts common null string equivalents to null', () => {
      assert.equal(transformer.execute('null'), null);
      assert.equal(transformer.execute('NULL'), null);
      assert.equal(transformer.execute('N/A'), null);
      assert.equal(transformer.execute('na'), null);
      assert.equal(transformer.execute('-'), null);
      assert.equal(transformer.execute('   '), null);
      assert.equal(transformer.execute('none'), null);
    });

    it('custom null markers support', () => {
      assert.equal(transformer.execute('MISSING', { nullMarkers: ['missing'] }), null);
      assert.equal(transformer.execute('Valid Value'), 'Valid Value');
    });
  });

  describe('ToNumber & ToDecimal Transformers', () => {
    const toNumber = new ToNumberTransformer();
    const toDecimal = new ToDecimalTransformer();

    it('parses integers and numeric strings', () => {
      assert.equal(toNumber.execute('42'), 42);
      assert.equal(toDecimal.execute('$ 1,234.50'), 1234.5);
      assert.equal(toNumber.execute(' -10 '), -10);
    });

    it('parses decimals and rounds precision when specified', () => {
      assert.equal(toDecimal.execute('19.99'), 19.99);
      assert.equal(toDecimal.execute('19.9999', { precision: 2 }), 20.0);
      assert.equal(toDecimal.execute('12.344', { precision: 2 }), 12.34);
    });

    it('returns null for null / empty input and throws error on unparseable numeric string', () => {
      assert.equal(toNumber.execute(''), null);
      assert.equal(toNumber.execute(null), null);
      assert.throws(() => toNumber.execute('abc'), /is not a valid whole number/);
    });
  });

  describe('ToBooleanTransformer', () => {
    const transformer = new ToBooleanTransformer();

    it('parses truthy values', () => {
      assert.equal(transformer.execute(true), true);
      assert.equal(transformer.execute('true'), true);
      assert.equal(transformer.execute('True'), true);
      assert.equal(transformer.execute('1'), true);
      assert.equal(transformer.execute('yes'), true);
      assert.equal(transformer.execute('y'), true);
    });

    it('parses falsy values', () => {
      assert.equal(transformer.execute(false), false);
      assert.equal(transformer.execute('false'), false);
      assert.equal(transformer.execute('0'), false);
      assert.equal(transformer.execute('no'), false);
      assert.equal(transformer.execute('n'), false);
    });

    it('returns null or throws for invalid booleans', () => {
      assert.equal(transformer.execute(null), null);
      assert.throws(() => transformer.execute('maybe'), /Cannot convert 'maybe' to boolean/);
    });
  });

  describe('ToDate & ToDateTime Transformers', () => {
    const toDate = new ToDateTransformer();
    const toDateTime = new ToDateTimeTransformer();

    it('parses standard ISO date and returns YYYY-MM-DD', () => {
      assert.equal(toDate.execute('2026-05-15'), '2026-05-15');
      assert.equal(toDate.execute('2026-05-15T14:30:00Z'), '2026-05-15');
    });

    it('parses Date instances', () => {
      const d = new Date('2026-08-10T00:00:00.000Z');
      assert.equal(toDate.execute(d), '2026-08-10');
    });

    it('parses datetime into ISO string', () => {
      const res = toDateTime.execute('2026-05-15T10:00:00.000Z');
      assert.ok(typeof res === 'string');
      assert.ok((res as string).startsWith('2026-05-15T'));
    });

    it('throws on invalid date input', () => {
      assert.throws(() => toDate.execute('not-a-date'), /is not a valid date/);
    });
  });

  describe('PhoneFormatTransformer', () => {
    const transformer = new PhoneFormatTransformer();

    it('cleanses and formats phone number', () => {
      assert.equal(transformer.execute('+1-555-0199'), '+15550199');
      assert.equal(transformer.execute('+44 20 7946 0958'), '+442079460958');
    });

    it('returns null on null input', () => {
      assert.equal(transformer.execute(null), null);
    });
  });

  describe('PrefixSuffixTransformer & DefaultValueTransformer', () => {
    const prefixSuffix = new PrefixSuffixTransformer();
    const defaultValue = new DefaultValueTransformer();

    it('applies prefix and suffix', () => {
      assert.equal(prefixSuffix.execute('100', { prefix: 'INV-' }), 'INV-100');
      assert.equal(prefixSuffix.execute('100', { suffix: '-2026' }), '100-2026');
      assert.equal(prefixSuffix.execute('100', { prefix: 'INV-', suffix: '-2026' }), 'INV-100-2026');
      assert.equal(prefixSuffix.execute(null, { prefix: 'INV-' }), null);
    });

    it('applies default value when null or blank', () => {
      assert.equal(defaultValue.execute(null, { defaultValue: 'DEFAULT' }), 'DEFAULT');
      assert.equal(defaultValue.execute('', { defaultValue: 'DEFAULT' }), 'DEFAULT');
      assert.equal(defaultValue.execute('Existing', { defaultValue: 'DEFAULT' }), 'Existing');
    });
  });
});
