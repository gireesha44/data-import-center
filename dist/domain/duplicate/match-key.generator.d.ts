/**
 * Match Key Generator for Deterministic Duplicate Detection
 */
import { DuplicateRuleDefinition, EntityFieldDefinition } from '../../core/registry/entity-schema.registry.js';
export interface GeneratedMatchKey {
    canonicalKey: string;
    displayKey: string;
    hash: string;
}
export declare class MatchKeyGenerator {
    /**
     * Generates a collision-safe canonical key and deterministic SHA-256 hash.
     * Returns null if any required key field is null, undefined, or empty string.
     */
    static generateMatchKey(recordData: Record<string, unknown>, rule: DuplicateRuleDefinition, fieldDefinitions?: Record<string, EntityFieldDefinition>): GeneratedMatchKey | null;
    /**
     * Field-specific safe normalization
     */
    private static normalizeValue;
}
//# sourceMappingURL=match-key.generator.d.ts.map