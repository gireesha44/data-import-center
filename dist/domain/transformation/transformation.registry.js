/**
 * Transformation Registry
 * Authoritative registry of pluggable, safe transformation functions
 */
import { TrimTransformer, LowercaseTransformer, UppercaseTransformer, NullNormalizeTransformer, ToStringTransformer, ToNumberTransformer, ToDecimalTransformer, ToBooleanTransformer, ToDateTransformer, ToDateTimeTransformer, PhoneFormatTransformer, PrefixSuffixTransformer, DefaultValueTransformer, NormalizeEnumTransformer } from './built-in.transformers.js';
export class TransformationRegistry {
    transformers = new Map();
    constructor() {
        this.registerDefaults();
    }
    registerTransformer(transformer) {
        const key = transformer.name.toUpperCase();
        this.transformers.set(key, transformer);
    }
    getTransformer(name) {
        if (!name)
            return undefined;
        return this.transformers.get(name.toUpperCase());
    }
    listTransformers() {
        return Array.from(this.transformers.values());
    }
    hasTransformer(name) {
        if (!name)
            return false;
        return this.transformers.has(name.toUpperCase());
    }
    registerDefaults() {
        this.registerTransformer(new TrimTransformer());
        this.registerTransformer(new LowercaseTransformer());
        this.registerTransformer(new UppercaseTransformer());
        this.registerTransformer(new NullNormalizeTransformer());
        this.registerTransformer(new ToStringTransformer());
        this.registerTransformer(new ToNumberTransformer());
        this.registerTransformer(new ToDecimalTransformer());
        this.registerTransformer(new ToBooleanTransformer());
        this.registerTransformer(new ToDateTransformer());
        this.registerTransformer(new ToDateTimeTransformer());
        this.registerTransformer(new PhoneFormatTransformer());
        this.registerTransformer(new PrefixSuffixTransformer());
        this.registerTransformer(new DefaultValueTransformer());
        this.registerTransformer(new NormalizeEnumTransformer());
    }
}
export const transformationRegistry = new TransformationRegistry();
//# sourceMappingURL=transformation.registry.js.map