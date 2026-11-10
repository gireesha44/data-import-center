/**
 * Built-in Transformation Implementations
 * Side-effect free, deterministic, bounded functions for cell-level transformation.
 */

import { ITransformation, TransformContext } from '../../core/types/transformation.types.js';
import { ValidationError } from '../../core/errors/import.errors.js';

export class TrimTransformer implements ITransformation {
  public readonly name = 'TRIM';
  public readonly description = 'Trims leading and trailing whitespace from string values';

  public execute(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  }
}

export class LowercaseTransformer implements ITransformation {
  public readonly name = 'LOWERCASE';
  public readonly description = 'Converts string values to lowercase';

  public execute(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    return value;
  }
}

export class UppercaseTransformer implements ITransformation {
  public readonly name = 'UPPERCASE';
  public readonly description = 'Converts string values to uppercase';

  public execute(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
    return value;
  }
}

export class NullNormalizeTransformer implements ITransformation {
  public readonly name = 'NULL_NORMALIZE';
  public readonly description = 'Normalizes empty strings and configured null markers to null';

  public execute(value: unknown, options?: Record<string, unknown>): unknown {
    if (value === null || value === undefined) return null;

    const defaultMarkers = ['', 'null', 'nil', 'n/a', 'na', '-', 'none', 'undefined'];
    const customMarkers = Array.isArray(options?.nullMarkers)
      ? (options!.nullMarkers as string[]).map((m) => String(m).toLowerCase().trim())
      : defaultMarkers;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (customMarkers.includes(trimmed.toLowerCase())) {
        return null;
      }
      return trimmed;
    }

    return value;
  }
}

export class ToStringTransformer implements ITransformation {
  public readonly name = 'TO_STRING';
  public readonly description = 'Safely converts any value to its string representation';

  public execute(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    return String(value);
  }
}

export class ToNumberTransformer implements ITransformation {
  public readonly name = 'TO_NUMBER';
  public readonly description = 'Converts string or numeric input into a signed integer';

  public execute(value: unknown): unknown {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new ValidationError('Invalid number: Infinite or NaN');
      return Math.trunc(value);
    }

    if (typeof value === 'string') {
      const cleaned = value.trim().replace(/[$€£¥, ]/g, '');
      const parsed = Number(cleaned);
      if (isNaN(parsed) || !Number.isFinite(parsed)) {
        throw new ValidationError(`The value '${value}' is not a valid whole number. Enter a value such as 1250.`);
      }
      return Math.trunc(parsed);
    }

    throw new ValidationError(`The value has type '${typeof value}' and cannot be converted to a whole number. Enter a valid numeric value.`);
  }
}

export class ToDecimalTransformer implements ITransformation {
  public readonly name = 'TO_DECIMAL';
  public readonly description = 'Converts input into a decimal number with optional scale/precision';

  public execute(value: unknown, options?: Record<string, unknown>): unknown {
    if (value === null || value === undefined || value === '') return null;

    let num: number;
    if (typeof value === 'number') {
      num = value;
    } else if (typeof value === 'string') {
      const cleaned = value.trim().replace(/[$€£¥, ]/g, '');
      num = parseFloat(cleaned);
    } else {
      throw new ValidationError(`The value has type '${typeof value}' and cannot be converted to a decimal. Enter a valid numeric value.`);
    }

    if (isNaN(num) || !Number.isFinite(num)) {
      throw new ValidationError(`The value '${value}' is not a valid decimal number. Enter a value such as 1250.50.`);
    }

    const precision = typeof options?.precision === 'number' ? options.precision : undefined;
    if (precision !== undefined && precision >= 0) {
      const factor = Math.pow(10, precision);
      return Math.round(num * factor) / factor;
    }

    return num;
  }
}

export class ToBooleanTransformer implements ITransformation {
  public readonly name = 'TO_BOOLEAN';
  public readonly description = 'Converts truthy/falsy representations to boolean true/false';

  public execute(value: unknown): unknown {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value;

    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    if (typeof value === 'string') {
      const lower = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 't', 'on'].includes(lower)) return true;
      if (['false', '0', 'no', 'n', 'f', 'off'].includes(lower)) return false;
    }

    throw new ValidationError(`Cannot convert '${value}' to boolean`);
  }
}

export class ToDateTransformer implements ITransformation {
  public readonly name = 'TO_DATE';
  public readonly description = 'Converts input string or timestamp to ISO date string (YYYY-MM-DD)';

  public execute(value: unknown, options?: Record<string, unknown>): unknown {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date) {
      if (isNaN(value.getTime())) throw new ValidationError('Invalid Date instance');
      return value.toISOString().split('T')[0];
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const str = String(value).trim();

      // Check standard ISO YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const d = new Date(str + 'T00:00:00Z');
        if (!isNaN(d.getTime())) return str;
      }

      // Check DD/MM/YYYY or DD-MM-YYYY
      const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (ddmmyyyy) {
        const day = parseInt(ddmmyyyy[1], 10);
        const month = parseInt(ddmmyyyy[2], 10);
        const year = parseInt(ddmmyyyy[3], 10);

        // Disambiguation option: if format is explicit 'MM/DD/YYYY'
        if (options?.dateFormat === 'MM/DD/YYYY' || month > 12) {
          const iso = `${year}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
          const d = new Date(iso + 'T00:00:00Z');
          if (!isNaN(d.getTime())) return iso;
        } else {
          const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const d = new Date(iso + 'T00:00:00Z');
          if (!isNaN(d.getTime())) return iso;
        }
      }

      const timestamp = Date.parse(str);
      if (!isNaN(timestamp)) {
        const d = new Date(timestamp);
        return d.toISOString().split('T')[0];
      }
    }

    throw new ValidationError(`The value '${value}' is not a valid date. Enter YYYY-MM-DD or another unambiguous date format.`);
  }
}

export class ToDateTimeTransformer implements ITransformation {
  public readonly name = 'TO_DATETIME';
  public readonly description = 'Converts input string or timestamp to ISO 8601 UTC datetime string';

  public execute(value: unknown): unknown {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date) {
      if (isNaN(value.getTime())) throw new ValidationError('Invalid Date instance');
      return value.toISOString();
    }

    const str = String(value).trim();
    const timestamp = Date.parse(str);
    if (!isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }

    throw new ValidationError(`Invalid datetime format for value '${value}'`);
  }
}

export class PhoneFormatTransformer implements ITransformation {
  public readonly name = 'PHONE_FORMAT';
  public readonly description = 'Normalizes phone numbers to standard format';

  public execute(value: unknown, options?: Record<string, unknown>): unknown {
    if (value === null || value === undefined || value === '') return null;

    const str = String(value).trim();
    const hasPlus = str.startsWith('+');
    const digits = str.replace(/\D/g, '');

    if (digits.length < 7) {
      throw new ValidationError(`Phone number '${value}' has too few digits`);
    }

    if (hasPlus) {
      return `+${digits}`;
    }

    const defaultCountryCode = (options?.defaultCountryCode as string) || '';
    if (defaultCountryCode && !digits.startsWith(defaultCountryCode.replace(/\D/g, ''))) {
      return `+${defaultCountryCode.replace(/\D/g, '')}${digits}`;
    }

    return digits;
  }
}

export class PrefixSuffixTransformer implements ITransformation {
  public readonly name = 'PREFIX_SUFFIX';
  public readonly description = 'Appends prefix or suffix to string values';

  public execute(value: unknown, options?: Record<string, unknown>): unknown {
    if (value === null || value === undefined || value === '') return null;

    const prefix = (options?.prefix as string) || '';
    const suffix = (options?.suffix as string) || '';
    return `${prefix}${String(value)}${suffix}`;
  }
}

export class DefaultValueTransformer implements ITransformation {
  public readonly name = 'DEFAULT_VALUE';
  public readonly description = 'Substitutes default value if source value is null or empty';

  public execute(value: unknown, options?: Record<string, unknown>): unknown {
    if (value === null || value === undefined || value === '') {
      return options?.defaultValue !== undefined ? options.defaultValue : null;
    }
    return value;
  }
}

export class NormalizeEnumTransformer implements ITransformation {
  public readonly name = 'NORMALIZE_ENUM';
  public readonly description = 'Safely normalizes a source value to a configured canonical enum value';

  public execute(value: unknown, options?: Record<string, unknown>): unknown {
    if (value === null || value === undefined || value === '') return null;
    const str = String(value).trim();
    const enumValues = Array.isArray(options?.enumValues) ? (options!.enumValues as string[]) : [];
    const enumAliases = (options?.enumAliases && typeof options.enumAliases === 'object')
      ? options.enumAliases as Record<string, string>
      : {};

    if (!enumValues.length) return str;
    if (enumValues.includes(str)) return str;

    const lower = str.toLowerCase();
    const exactCaseInsensitive = enumValues.find((e) => e.toLowerCase() === lower);
    if (exactCaseInsensitive) return exactCaseInsensitive;

    const normalize = (input: string) => input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
    const normalized = normalize(str);
    const normalizedMatch = enumValues.find((e) => normalize(e) === normalized);
    if (normalizedMatch) return normalizedMatch;

    const explicitAlias = Object.entries(enumAliases).find(([alias]) => normalize(alias) === normalized);
    if (explicitAlias && enumValues.includes(explicitAlias[1])) return explicitAlias[1];

    // Safe acronym mapping: HR -> Human Resources, H.R. -> Human Resources, etc.
    const acronym = normalized.split(' ').filter(Boolean).map((word) => word[0]).join('');
    if (acronym.length >= 2) {
      const acronymMatches = enumValues.filter((candidate) => {
        const candidateAcronym = normalize(candidate).split(' ').filter(Boolean).map((word) => word[0]).join('');
        return candidateAcronym === acronym;
      });
      if (acronymMatches.length === 1) return acronymMatches[0];
    }

    return str;
  }
}
