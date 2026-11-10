/**
 * Built-in Transformation Implementations
 * Side-effect free, deterministic, bounded functions for cell-level transformation.
 */
import { ITransformation } from '../../core/types/transformation.types.js';
export declare class TrimTransformer implements ITransformation {
    readonly name = "TRIM";
    readonly description = "Trims leading and trailing whitespace from string values";
    execute(value: unknown): unknown;
}
export declare class LowercaseTransformer implements ITransformation {
    readonly name = "LOWERCASE";
    readonly description = "Converts string values to lowercase";
    execute(value: unknown): unknown;
}
export declare class UppercaseTransformer implements ITransformation {
    readonly name = "UPPERCASE";
    readonly description = "Converts string values to uppercase";
    execute(value: unknown): unknown;
}
export declare class NullNormalizeTransformer implements ITransformation {
    readonly name = "NULL_NORMALIZE";
    readonly description = "Normalizes empty strings and configured null markers to null";
    execute(value: unknown, options?: Record<string, unknown>): unknown;
}
export declare class ToStringTransformer implements ITransformation {
    readonly name = "TO_STRING";
    readonly description = "Safely converts any value to its string representation";
    execute(value: unknown): unknown;
}
export declare class ToNumberTransformer implements ITransformation {
    readonly name = "TO_NUMBER";
    readonly description = "Converts string or numeric input into a signed integer";
    execute(value: unknown): unknown;
}
export declare class ToDecimalTransformer implements ITransformation {
    readonly name = "TO_DECIMAL";
    readonly description = "Converts input into a decimal number with optional scale/precision";
    execute(value: unknown, options?: Record<string, unknown>): unknown;
}
export declare class ToBooleanTransformer implements ITransformation {
    readonly name = "TO_BOOLEAN";
    readonly description = "Converts truthy/falsy representations to boolean true/false";
    execute(value: unknown): unknown;
}
export declare class ToDateTransformer implements ITransformation {
    readonly name = "TO_DATE";
    readonly description = "Converts input string or timestamp to ISO date string (YYYY-MM-DD)";
    execute(value: unknown, options?: Record<string, unknown>): unknown;
}
export declare class ToDateTimeTransformer implements ITransformation {
    readonly name = "TO_DATETIME";
    readonly description = "Converts input string or timestamp to ISO 8601 UTC datetime string";
    execute(value: unknown): unknown;
}
export declare class PhoneFormatTransformer implements ITransformation {
    readonly name = "PHONE_FORMAT";
    readonly description = "Normalizes phone numbers to standard format";
    execute(value: unknown, options?: Record<string, unknown>): unknown;
}
export declare class PrefixSuffixTransformer implements ITransformation {
    readonly name = "PREFIX_SUFFIX";
    readonly description = "Appends prefix or suffix to string values";
    execute(value: unknown, options?: Record<string, unknown>): unknown;
}
export declare class DefaultValueTransformer implements ITransformation {
    readonly name = "DEFAULT_VALUE";
    readonly description = "Substitutes default value if source value is null or empty";
    execute(value: unknown, options?: Record<string, unknown>): unknown;
}
export declare class NormalizeEnumTransformer implements ITransformation {
    readonly name = "NORMALIZE_ENUM";
    readonly description = "Safely normalizes a source value to a configured canonical enum value";
    execute(value: unknown, options?: Record<string, unknown>): unknown;
}
//# sourceMappingURL=built-in.transformers.d.ts.map