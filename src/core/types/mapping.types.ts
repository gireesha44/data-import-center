/**
 * Core Type Definitions for Column Mapping & Schema Engine
 */

import { FieldDataType } from '../registry/entity-schema.registry.js';

export type MappingMethod = 'AUTOMATIC' | 'MANUAL' | 'TEMPLATE';

export type MappingConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type MappingTechnique = 'RULE' | 'FUZZY' | 'SEMANTIC' | 'EMBEDDING' | 'TYPE' | 'PATTERN' | 'AI';

export interface MappingEvidence {
  technique: MappingTechnique;
  score: number;
  explanation: string;
}

export type TypeCompatibility = 'COMPATIBLE' | 'TRANSFORM_REQUIRED' | 'INCOMPATIBLE' | 'UNKNOWN';

export interface SourceColumn {
  index: number;
  originalName: string;
  normalizedName: string;
  inferredType: FieldDataType;
  sampleValues: unknown[];
  emptyPercentage: number;
  statistics?: {
    totalSamples: number;
    distinctCount: number;
    nullCount: number;
  };
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  mappingMethod: MappingMethod;
  confidence: MappingConfidence;
  confidenceScore: number; // 0.0 to 1.0
  compatibility: TypeCompatibility;
  enabled: boolean;
  defaultValue?: unknown;
  matchReason?: string;
  metadata?: Record<string, unknown>;
  evidence?: MappingEvidence[];

}

export interface MappingAlternative {
  targetField: string;
  targetLabel: string;
  confidence: MappingConfidence;
  confidenceScore: number;
  reason: string;
}

export interface MappingSuggestion {
  sourceColumn: string;
  suggestedTargetField?: string;
  confidence: MappingConfidence;
  confidenceScore: number;
  compatibility: TypeCompatibility;
  matchReason: string;
  isAmbiguous: boolean;
  alternatives: MappingAlternative[];
  evidence?: MappingEvidence[];
  techniques?: MappingTechnique[];
  autoApply?: boolean;
  suggestedTransformations?: Array<{ type: string; confidence: number; explanation: string }>;
}

export interface MappingSuggestionResult {
  entity: string;
  totalSourceColumns: number;
  mappedCount: number;
  unmappedCount: number;
  ambiguousCount: number;
  suggestions: MappingSuggestion[];
  sourceColumns: SourceColumn[];
}

export interface MappingIssue {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFORMATION';
  sourceColumn?: string;
  targetField?: string;
}

export interface MappingValidationResult {
  isValid: boolean;
  entity: string;
  mappings: Record<string, ColumnMapping>;
  mappedSourceColumns: string[];
  unmappedSourceColumns: string[];
  mappedRequiredFields: string[];
  unmappedRequiredFields: string[];
  incompatibleMappings: string[];
  ambiguousMappings: string[];
  issues: MappingIssue[];
  warnings: string[];
  errors: string[];
}

export interface SaveMappingInput {
  columnMappings?: Record<string, {
    targetField: string;
    mappingMethod?: MappingMethod;
    defaultValue?: unknown;
    enabled?: boolean;
    transformations?: Array<string | { type: string; options?: Record<string, unknown> }>;
  }>;
  unmappedBehavior?: 'IGNORE' | 'SET_NULL';
  defaultValues?: Record<string, unknown>;
}
