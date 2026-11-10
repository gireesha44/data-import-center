/**
 * Enterprise multi-signal mapping engine.
 *
 * Mapping order/signals:
 *   1. deterministic rules (exact/normalized/alias/label/token)
 *   2. fuzzy matching (Levenshtein)
 *   3. semantic / embedding-style similarity
 *   4. data-type compatibility
 *   5. value-pattern compatibility (samples)
 *   6. conflict resolution + confidence margin
 *
 * The engine is deliberately explainable. Every suggestion carries a score,
 * the techniques that contributed to it, and human-readable evidence.
 */
import { EntitySchemaDefinition } from '../../core/registry/entity-schema.registry.js';
import { MappingSuggestionResult, SourceColumn } from '../../core/types/mapping.types.js';
export interface IMappingSuggestionProvider {
    generateSuggestions(sourceColumns: SourceColumn[], schema: EntitySchemaDefinition): MappingSuggestionResult;
}
export declare class DeterministicMappingSuggestionProvider implements IMappingSuggestionProvider {
    generateSuggestions(sourceColumns: SourceColumn[], schema: EntitySchemaDefinition): MappingSuggestionResult;
    private scoreCandidates;
}
//# sourceMappingURL=mapping-suggestion.provider.d.ts.map