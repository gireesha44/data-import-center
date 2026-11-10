/**
 * Optional AI/embedding mapping enrichment contract.
 *
 * The core import engine never requires a network AI service. When
 * DATA_IMPORT_AI_MAPPING_URL is configured, this provider can enrich only
 * unresolved/ambiguous mappings. Deterministic rules remain authoritative and
 * AI suggestions are never allowed to overwrite a high-confidence rule match.
 */
import { EntitySchemaDefinition } from '../../core/registry/entity-schema.registry.js';
import { MappingSuggestionResult, SourceColumn } from '../../core/types/mapping.types.js';
export interface AiMappingHint {
    sourceColumn: string;
    targetField: string;
    confidence: number;
    explanation: string;
}
export interface IAiMappingProvider {
    enrich(result: MappingSuggestionResult, sourceColumns: SourceColumn[], schema: EntitySchemaDefinition): Promise<MappingSuggestionResult>;
}
export declare class HttpAiMappingProvider implements IAiMappingProvider {
    private readonly endpoint;
    private readonly apiKey;
    enrich(result: MappingSuggestionResult, sourceColumns: SourceColumn[], schema: EntitySchemaDefinition): Promise<MappingSuggestionResult>;
}
//# sourceMappingURL=ai-mapping.provider.d.ts.map