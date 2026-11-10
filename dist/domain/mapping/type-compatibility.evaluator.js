/**
 * Type Compatibility Evaluator for Column Mapping
 */
export class TypeCompatibilityEvaluator {
    /**
     * Evaluates the type compatibility between a source inferred type and target field type
     */
    static evaluate(sourceType, targetType) {
        if (sourceType === 'UNKNOWN') {
            return 'UNKNOWN';
        }
        // Exact type match is always COMPATIBLE
        if (sourceType === targetType) {
            return 'COMPATIBLE';
        }
        // Target STRING can accept almost any primitive type directly
        if (targetType === 'STRING') {
            return 'COMPATIBLE';
        }
        // Numeric conversions
        if ((sourceType === 'NUMBER' && targetType === 'DECIMAL') ||
            (sourceType === 'DECIMAL' && targetType === 'NUMBER')) {
            return 'COMPATIBLE';
        }
        // String to specialized types requires transformation/parsing
        if (sourceType === 'STRING') {
            switch (targetType) {
                case 'NUMBER':
                case 'DECIMAL':
                case 'DATE':
                case 'DATETIME':
                case 'BOOLEAN':
                case 'ENUM':
                    return 'TRANSFORM_REQUIRED';
                case 'EMAIL':
                case 'PHONE':
                case 'IDENTIFIER':
                case 'REFERENCE':
                    return 'COMPATIBLE';
            }
        }
        // Semantic subtypes to other incompatible types
        if (sourceType === 'EMAIL' || sourceType === 'PHONE') {
            return 'INCOMPATIBLE';
        }
        // Date to DateTime
        if (sourceType === 'DATE' && targetType === 'DATETIME') {
            return 'TRANSFORM_REQUIRED';
        }
        // DateTime to Date
        if (sourceType === 'DATETIME' && targetType === 'DATE') {
            return 'TRANSFORM_REQUIRED';
        }
        // Numeric to Date or Boolean is transform required
        if (sourceType === 'NUMBER' && (targetType === 'DATE' || targetType === 'BOOLEAN')) {
            return 'TRANSFORM_REQUIRED';
        }
        // Default fallback: incompatible
        return 'INCOMPATIBLE';
    }
}
//# sourceMappingURL=type-compatibility.evaluator.js.map