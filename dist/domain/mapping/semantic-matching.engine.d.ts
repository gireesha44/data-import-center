/**
 * Local semantic / embedding-style matching engine.
 *
 * This intentionally has no external dependency or network call. It builds a
 * small semantic feature vector from normalized tokens, business synonyms and
 * character n-grams, then compares source headers with target names, labels
 * and aliases. The engine is deterministic, explainable and safe to use as a
 * fallback when an external AI/embedding provider is not configured.
 */
export interface SemanticMatchEvidence {
    score: number;
    explanation: string;
    matchedConcepts: string[];
}
export declare class SemanticMatchingEngine {
    static score(source: string, targetCandidates: string[]): SemanticMatchEvidence;
}
//# sourceMappingURL=semantic-matching.engine.d.ts.map