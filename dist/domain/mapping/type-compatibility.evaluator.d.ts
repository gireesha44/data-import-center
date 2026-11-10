/**
 * Type Compatibility Evaluator for Column Mapping
 */
import { FieldDataType } from '../../core/registry/entity-schema.registry.js';
import { TypeCompatibility } from '../../core/types/mapping.types.js';
export declare class TypeCompatibilityEvaluator {
    /**
     * Evaluates the type compatibility between a source inferred type and target field type
     */
    static evaluate(sourceType: FieldDataType | 'UNKNOWN', targetType: FieldDataType): TypeCompatibility;
}
//# sourceMappingURL=type-compatibility.evaluator.d.ts.map