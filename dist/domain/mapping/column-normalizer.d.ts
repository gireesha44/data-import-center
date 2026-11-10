/**
 * Column Normalizer & Type Inference Service
 */
import { FieldDataType } from '../../core/registry/entity-schema.registry.js';
import { SourceColumn } from '../../core/types/mapping.types.js';
import { ParsedDataset } from '../../core/types/parser.types.js';
export declare class ColumnNormalizer {
    /**
     * Deterministically normalizes a column or field name to snake_case lowercase tokens
     * e.g., "First Name", "firstName", "first-name", "FIRST_NAME", "First   Name!" -> "first_name"
     */
    static normalize(name: string): string;
    /**
     * Extracts token array from normalized string for multi-token fuzzy matching
     */
    static getTokens(name: string): string[];
    /**
     * Computes Levenshtein edit distance between two strings
     */
    static levenshteinDistance(a: string, b: string): number;
    /**
     * Calculates similarity ratio (0.0 to 1.0) between two strings
     */
    static similarityRatio(a: string, b: string): number;
    /**
     * Infers primitive/semantic field data type from sample cell values
     */
    static inferDataType(sampleValues: unknown[]): FieldDataType;
    /**
     * Constructs SourceColumn models from a ParsedDataset with metrics and type inference
     */
    static extractSourceColumns(dataset: ParsedDataset, maxSamplesPerColumn?: number): SourceColumn[];
    /**
     * Generates a comprehensive column data profile for parsed dataset
     */
    static profileDataset(dataset: ParsedDataset, targetSchemaFields?: Record<string, {
        name: string;
        label: string;
        aliases?: string[];
        type: string;
    }>): Record<string, unknown>[];
}
//# sourceMappingURL=column-normalizer.d.ts.map