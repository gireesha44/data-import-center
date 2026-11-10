/**
 * Optional AI/embedding mapping enrichment contract.
 *
 * The core import engine never requires a network AI service. When
 * DATA_IMPORT_AI_MAPPING_URL is configured, this provider can enrich only
 * unresolved/ambiguous mappings. Deterministic rules remain authoritative and
 * AI suggestions are never allowed to overwrite a high-confidence rule match.
 */
export class HttpAiMappingProvider {
    endpoint = process.env.DATA_IMPORT_AI_MAPPING_URL;
    apiKey = process.env.DATA_IMPORT_AI_MAPPING_API_KEY;
    async enrich(result, sourceColumns, schema) {
        if (!this.endpoint)
            return result;
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
                },
                body: JSON.stringify({
                    sourceColumns: sourceColumns.map((c) => ({
                        name: c.originalName,
                        inferredType: c.inferredType,
                        sampleValues: c.sampleValues.slice(0, 5)
                    })),
                    targetEntity: schema.entity,
                    targetFields: Object.values(schema.fields).filter((f) => !f.readOnly).map((f) => ({
                        name: f.name,
                        label: f.label,
                        type: f.type,
                        required: f.required,
                        aliases: f.aliases || []
                    }))
                })
            });
            if (!response.ok)
                return result;
            const payload = await response.json();
            const matches = Array.isArray(payload.matches) ? payload.matches : [];
            const validTargets = new Set(Object.values(schema.fields).filter((f) => !f.readOnly).map((f) => f.name));
            for (const hint of matches) {
                if (!validTargets.has(hint.targetField))
                    continue;
                if (!hint.sourceColumn || !Number.isFinite(hint.confidence) || hint.confidence < 0.85)
                    continue;
                const suggestion = result.suggestions.find((s) => s.sourceColumn === hint.sourceColumn);
                if (!suggestion || suggestion.suggestedTargetField)
                    continue;
                suggestion.alternatives.unshift({
                    targetField: hint.targetField,
                    targetLabel: schema.fields[hint.targetField]?.label || hint.targetField,
                    confidence: hint.confidence >= 0.90 ? 'HIGH' : 'MEDIUM',
                    confidenceScore: hint.confidence,
                    reason: `AI semantic suggestion: ${hint.explanation}`
                });
                suggestion.evidence = [
                    ...(suggestion.evidence || []),
                    { technique: 'AI', score: hint.confidence, explanation: hint.explanation }
                ];
                suggestion.techniques = [...new Set([...(suggestion.techniques || []), 'AI'])];
                // AI can only auto-apply a previously unmapped field when confidence is
                // high and there is no competing deterministic candidate.
                if (hint.confidence >= 0.92 && !suggestion.isAmbiguous) {
                    suggestion.suggestedTargetField = hint.targetField;
                    suggestion.confidence = 'HIGH';
                    suggestion.confidenceScore = hint.confidence;
                    suggestion.matchReason = `AI semantic mapping: ${hint.explanation}`;
                    suggestion.autoApply = true;
                }
            }
            return result;
        }
        catch {
            // AI is an enrichment layer, never a single point of failure for import mapping.
            return result;
        }
    }
}
//# sourceMappingURL=ai-mapping.provider.js.map