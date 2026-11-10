/**
 * Transformation Registry
 * Authoritative registry of pluggable, safe transformation functions
 */
import { ITransformation } from '../../core/types/transformation.types.js';
export interface ITransformationRegistry {
    registerTransformer(transformer: ITransformation): void;
    getTransformer(name: string): ITransformation | undefined;
    listTransformers(): ITransformation[];
    hasTransformer(name: string): boolean;
}
export declare class TransformationRegistry implements ITransformationRegistry {
    private transformers;
    constructor();
    registerTransformer(transformer: ITransformation): void;
    getTransformer(name: string): ITransformation | undefined;
    listTransformers(): ITransformation[];
    hasTransformer(name: string): boolean;
    private registerDefaults;
}
export declare const transformationRegistry: TransformationRegistry;
//# sourceMappingURL=transformation.registry.d.ts.map