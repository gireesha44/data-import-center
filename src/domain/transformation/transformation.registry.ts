/**
 * Transformation Registry
 * Authoritative registry of pluggable, safe transformation functions
 */

import { ITransformation } from '../../core/types/transformation.types.js';
import {
  TrimTransformer,
  LowercaseTransformer,
  UppercaseTransformer,
  NullNormalizeTransformer,
  ToStringTransformer,
  ToNumberTransformer,
  ToDecimalTransformer,
  ToBooleanTransformer,
  ToDateTransformer,
  ToDateTimeTransformer,
  PhoneFormatTransformer,
  PrefixSuffixTransformer,
  DefaultValueTransformer,
  NormalizeEnumTransformer
} from './built-in.transformers.js';

export interface ITransformationRegistry {
  registerTransformer(transformer: ITransformation): void;
  getTransformer(name: string): ITransformation | undefined;
  listTransformers(): ITransformation[];
  hasTransformer(name: string): boolean;
}

export class TransformationRegistry implements ITransformationRegistry {
  private transformers: Map<string, ITransformation> = new Map();

  constructor() {
    this.registerDefaults();
  }

  public registerTransformer(transformer: ITransformation): void {
    const key = transformer.name.toUpperCase();
    this.transformers.set(key, transformer);
  }

  public getTransformer(name: string): ITransformation | undefined {
    if (!name) return undefined;
    return this.transformers.get(name.toUpperCase());
  }

  public listTransformers(): ITransformation[] {
    return Array.from(this.transformers.values());
  }

  public hasTransformer(name: string): boolean {
    if (!name) return false;
    return this.transformers.has(name.toUpperCase());
  }

  private registerDefaults(): void {
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
