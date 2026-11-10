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

import { EntityFieldDefinition, EntitySchemaDefinition } from '../../core/registry/entity-schema.registry.js';
import {
  MappingAlternative,
  MappingConfidence,
  MappingEvidence,
  MappingSuggestion,
  MappingSuggestionResult,
  MappingTechnique,
  SourceColumn
} from '../../core/types/mapping.types.js';
import { ColumnNormalizer } from './column-normalizer.js';
import { TypeCompatibilityEvaluator } from './type-compatibility.evaluator.js';
import { SemanticMatchingEngine } from './semantic-matching.engine.js';

export interface IMappingSuggestionProvider {
  generateSuggestions(sourceColumns: SourceColumn[], schema: EntitySchemaDefinition): MappingSuggestionResult;
}

interface MatchCandidate {
  targetField: string;
  targetLabel: string;
  score: number;
  confidence: MappingConfidence;
  reason: string;
  fieldDef: EntityFieldDefinition;
  evidence: MappingEvidence[];
  techniques: MappingTechnique[];
  suggestedTransformations: Array<{ type: string; confidence: number; explanation: string }>;
}

const TYPE_COMPATIBLE: Record<string, string[]> = {
  EMAIL: ['EMAIL'],
  PHONE: ['PHONE'],
  IDENTIFIER: ['IDENTIFIER', 'STRING'],
  NUMBER: ['NUMBER', 'DECIMAL'],
  DECIMAL: ['DECIMAL', 'NUMBER'],
  DATE: ['DATE', 'DATETIME'],
  DATETIME: ['DATETIME', 'DATE'],
  BOOLEAN: ['BOOLEAN'],
  STRING: ['STRING', 'ENUM', 'IDENTIFIER', 'REFERENCE']
};

function confidenceFor(score: number): MappingConfidence {
  if (score >= 0.85) return 'HIGH';
  if (score >= 0.70) return 'MEDIUM';
  return 'LOW';
}

function sampleMatchesType(samples: unknown[], type: string, field: EntityFieldDefinition): number {
  const values = samples.filter((v) => v !== null && v !== undefined && String(v).trim() !== '').map((v) => String(v).trim());
  if (!values.length) return 0;

  let matched = 0;
  const email = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const date = /^(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})$/;

  for (const value of values) {
    let ok = false;
    if (type === 'EMAIL') ok = email.test(value);
    else if (type === 'PHONE') ok = value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15;
    else if (type === 'NUMBER' || type === 'DECIMAL') ok = Number.isFinite(Number(value.replace(/[$€£¥, ]/g, '')));
    else if (type === 'DATE' || type === 'DATETIME') ok = date.test(value) || !Number.isNaN(Date.parse(value));
    else if (type === 'BOOLEAN') ok = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(value.toLowerCase());
    else if (type === 'ENUM' && field.enumValues?.length) {
      const normalized = ColumnNormalizer.normalize(value);
      ok = field.enumValues.some((candidate) => ColumnNormalizer.normalize(candidate) === normalized);
    } else if (type === 'STRING' || type === 'IDENTIFIER' || type === 'REFERENCE') ok = true;
    if (ok) matched++;
  }

  return matched / values.length;
}

function enumValueEvidence(samples: unknown[], field: EntityFieldDefinition): { score: number; explanation: string } {
  if (field.type !== 'ENUM' || !field.enumValues?.length) return { score: 0, explanation: '' };
  const values = samples.filter((v) => v !== null && v !== undefined && String(v).trim() !== '').map(String);
  if (!values.length) return { score: 0, explanation: '' };
  let matched = 0;
  for (const value of values) {
    const norm = ColumnNormalizer.normalize(value);
    if (field.enumValues.some((allowed) => ColumnNormalizer.normalize(allowed) === norm)) matched++;
  }
  const score = matched / values.length;
  return score > 0 ? { score, explanation: `${Math.round(score * 100)}% of sample values match the target enum vocabulary` } : { score: 0, explanation: '' };
}

function suggestTransformations(source: SourceColumn, field: EntityFieldDefinition): Array<{ type: string; confidence: number; explanation: string }> {
  const suggestions: Array<{ type: string; confidence: number; explanation: string }> = [];
  const samples = source.sampleValues.filter((v) => v !== null && v !== undefined).map(String);
  const hasWhitespace = samples.some((v) => v !== v.trim());
  if (hasWhitespace) suggestions.push({ type: 'TRIM', confidence: 0.99, explanation: 'Leading/trailing whitespace is present in sample values.' });

  if (field.type === 'EMAIL') {
    const hasUpper = samples.some((v) => /[A-Z]/.test(v));
    if (hasUpper) suggestions.push({ type: 'LOWERCASE', confidence: 0.98, explanation: 'Email values contain uppercase characters; case normalization is safe.' });
  }
  if (field.type === 'ENUM') {
    const mixedCase = samples.some((v) => v !== v.toUpperCase());
    if (mixedCase) suggestions.push({ type: 'NORMALIZE_ENUM', confidence: 0.98, explanation: 'Enum values use inconsistent casing; normalization will preserve the configured canonical value.' });
  }
  if (field.type === 'NUMBER' || field.type === 'DECIMAL') {
    const formatted = samples.some((v) => /[$€£¥,\s]/.test(v));
    if (formatted) suggestions.push({ type: field.type === 'DECIMAL' ? 'TO_DECIMAL' : 'TO_NUMBER', confidence: 0.97, explanation: 'Numeric samples contain harmless currency/separator formatting.' });
  }
  if (field.type === 'DATE' || field.type === 'DATETIME') {
    const mixed = samples.some((v) => !/^\d{4}-\d{2}-\d{2}/.test(v));
    if (mixed) suggestions.push({ type: field.type === 'DATE' ? 'TO_DATE' : 'TO_DATETIME', confidence: 0.95, explanation: 'Date values require normalization to the target date format when unambiguous.' });
  }
  if (field.type === 'PHONE') {
    const formatted = samples.some((v) => /[()\s-]/.test(v));
    if (formatted) suggestions.push({ type: 'PHONE_FORMAT', confidence: 0.96, explanation: 'Phone values contain formatting characters that can be safely normalized.' });
  }
  return suggestions;
}

export class DeterministicMappingSuggestionProvider implements IMappingSuggestionProvider {
  public generateSuggestions(sourceColumns: SourceColumn[], schema: EntitySchemaDefinition): MappingSuggestionResult {
    const fields = Object.values(schema.fields).filter((f) => !f.readOnly);
    const columnCandidateMap = new Map<string, MatchCandidate[]>();

    for (const source of sourceColumns) {
      columnCandidateMap.set(source.originalName, this.scoreCandidates(source, fields));
    }

    const assignedTargetMap = new Map<string, { sourceCol: string; score: number }>();
    const columnToFinalTarget = new Map<string, MatchCandidate>();

    const sortedColumns = [...sourceColumns].sort((a, b) =>
      ((columnCandidateMap.get(b.originalName) || [])[0]?.score || 0) - ((columnCandidateMap.get(a.originalName) || [])[0]?.score || 0)
    );

    for (const source of sortedColumns) {
      const candidates = columnCandidateMap.get(source.originalName) || [];
      if (!candidates.length) continue;
      const top = candidates[0];
      const second = candidates[1];
      const ambiguous = second && second.score >= 0.70 && top.score - second.score <= 0.06;
      if (ambiguous) continue;
      if (top.score < 0.70) continue;

      const existing = assignedTargetMap.get(top.targetField);
      if (!existing || top.score > existing.score) {
        if (existing) columnToFinalTarget.delete(existing.sourceCol);
        assignedTargetMap.set(top.targetField, { sourceCol: source.originalName, score: top.score });
        columnToFinalTarget.set(source.originalName, top);
      }
    }

    const suggestions: MappingSuggestion[] = [];
    let mappedCount = 0;
    let ambiguousCount = 0;

    for (const source of sourceColumns) {
      const candidates = columnCandidateMap.get(source.originalName) || [];
      const assigned = columnToFinalTarget.get(source.originalName);
      const alternatives: MappingAlternative[] = candidates.slice(0, 5).map((c) => ({
        targetField: c.targetField,
        targetLabel: c.targetLabel,
        confidence: c.confidence,
        confidenceScore: c.score,
        reason: c.reason
      }));

      if (assigned) {
        mappedCount++;
        suggestions.push({
          sourceColumn: source.originalName,
          suggestedTargetField: assigned.targetField,
          confidence: assigned.confidence,
          confidenceScore: assigned.score,
          compatibility: TypeCompatibilityEvaluator.evaluate(source.inferredType, assigned.fieldDef.type),
          matchReason: assigned.reason,
          isAmbiguous: false,
          alternatives,
          evidence: assigned.evidence,
          techniques: assigned.techniques,
          autoApply: assigned.confidence === 'HIGH',
          suggestedTransformations: assigned.suggestedTransformations
        });
      } else {
        const second = candidates[1];
        const isAmbiguous = Boolean(candidates[0] && second && candidates[0].score >= 0.65 && second.score >= 0.65 && candidates[0].score - second.score <= 0.08);
        if (isAmbiguous) ambiguousCount++;
        const best = candidates[0];
        suggestions.push({
          sourceColumn: source.originalName,
          suggestedTargetField: undefined,
          confidence: isAmbiguous ? 'MEDIUM' : 'LOW',
          confidenceScore: best?.score || 0,
          compatibility: 'UNKNOWN',
          matchReason: isAmbiguous
            ? `Requires review: ${best.targetLabel} and ${second.targetLabel} are too close in confidence.`
            : best
              ? `${best.reason}; confidence is below the automatic-apply threshold.`
              : 'No matching target field found in the selected entity schema.',
          isAmbiguous,
          alternatives,
          evidence: best?.evidence || [],
          techniques: best?.techniques || [],
          autoApply: false,
          suggestedTransformations: best?.suggestedTransformations || []
        });
      }
    }

    return {
      entity: schema.entity,
      totalSourceColumns: sourceColumns.length,
      mappedCount,
      unmappedCount: sourceColumns.length - mappedCount,
      ambiguousCount,
      suggestions,
      sourceColumns
    };
  }

  private scoreCandidates(source: SourceColumn, fields: EntityFieldDefinition[]): MatchCandidate[] {
    const candidates: MatchCandidate[] = [];
    const sourceOriginal = source.originalName.toLowerCase().trim();
    const sourceNormalized = source.normalizedName || ColumnNormalizer.normalize(source.originalName);
    const sourceTokens = ColumnNormalizer.getTokens(source.originalName);

    for (const field of fields) {
      const targetName = field.name.toLowerCase();
      const targetNormalized = ColumnNormalizer.normalize(field.name);
      const targetLabelNormalized = ColumnNormalizer.normalize(field.label);
      const targetTokens = ColumnNormalizer.getTokens(field.name);

      let ruleScore = 0;
      let ruleExplanation = '';
      if (sourceOriginal === targetName || sourceNormalized === targetName) {
        ruleScore = 1; ruleExplanation = 'Exact field-name rule match.';
      } else if (sourceNormalized === targetNormalized) {
        ruleScore = 0.96; ruleExplanation = 'Normalized field-name rule match.';
      } else if (field.aliases?.some((a) => ColumnNormalizer.normalize(a) === sourceNormalized)) {
        ruleScore = 0.93; ruleExplanation = 'Configured field-alias rule match.';
      } else if (sourceNormalized === targetLabelNormalized) {
        ruleScore = 0.88; ruleExplanation = 'Target label rule match.';
      } else if (sourceTokens.length && targetTokens.length && (sourceTokens.every((t) => targetTokens.includes(t)) || targetTokens.every((t) => sourceTokens.includes(t)))) {
        ruleScore = 0.80; ruleExplanation = 'Token-overlap rule match.';
      }

      const fuzzyName = ColumnNormalizer.similarityRatio(sourceNormalized, targetNormalized);
      const fuzzyLabel = ColumnNormalizer.similarityRatio(sourceNormalized, targetLabelNormalized);
      const fuzzyAlias = Math.max(0, ...(field.aliases || []).map((a) => ColumnNormalizer.similarityRatio(sourceNormalized, ColumnNormalizer.normalize(a))));
      const fuzzyScore = Math.max(fuzzyName, fuzzyLabel, fuzzyAlias);

      const semanticTargets = [field.name, field.label, ...(field.aliases || [])];
      const semantic = SemanticMatchingEngine.score(source.originalName, semanticTargets);
      const semanticScore = semantic.score;

      const compatibleTypes = TYPE_COMPATIBLE[source.inferredType] || [];
      const typeScore = compatibleTypes.includes(field.type) ? 1 : 0;
      const typeCompatibility = TypeCompatibilityEvaluator.evaluate(source.inferredType, field.type);
      const patternScore = sampleMatchesType(source.sampleValues, field.type, field);
      const enumEvidence = enumValueEvidence(source.sampleValues, field);

      const evidence: MappingEvidence[] = [];
      if (ruleScore) evidence.push({ technique: 'RULE', score: ruleScore, explanation: ruleExplanation });
      if (fuzzyScore >= 0.55) evidence.push({ technique: 'FUZZY', score: Math.round(fuzzyScore * 100) / 100, explanation: `Fuzzy header similarity is ${Math.round(fuzzyScore * 100)}%.` });
      if (semanticScore >= 0.45) evidence.push({ technique: 'SEMANTIC', score: semanticScore, explanation: semantic.explanation });
      if (semanticScore >= 0.60) evidence.push({ technique: 'EMBEDDING', score: semanticScore, explanation: 'Local semantic vector similarity supports the same target field.' });
      if (typeScore) evidence.push({ technique: 'TYPE', score: typeScore, explanation: `Detected source type ${source.inferredType} is compatible with target type ${field.type}.` });
      if (patternScore >= 0.50) evidence.push({ technique: 'PATTERN', score: Math.round(patternScore * 100) / 100, explanation: `${Math.round(patternScore * 100)}% of sample values fit the target field type.` });
      if (enumEvidence.score >= 0.50) evidence.push({ technique: 'PATTERN', score: enumEvidence.score, explanation: enumEvidence.explanation });

      if (typeCompatibility === 'INCOMPATIBLE') continue;

      let score = ruleScore;
      const semanticFuzzyScore = Math.max(fuzzyScore * 0.92, semanticScore * 0.90);
      score = Math.max(score, semanticFuzzyScore);
      if (typeScore && score < 0.95) score += 0.06;
      if (patternScore >= 0.70 && score < 0.95) score += 0.06;
      if (enumEvidence.score >= 0.70 && score < 0.95) score += 0.04;
      if (typeCompatibility === 'TRANSFORM_REQUIRED') score += 0.01;

      // Specialized source types are strong evidence. Do not let a generic
      // STRING field win merely because its label is lexically similar.
      const specializedSource = ['EMAIL', 'PHONE', 'DATE', 'DATETIME', 'BOOLEAN', 'NUMBER', 'DECIMAL'].includes(source.inferredType);
      const genericTarget = ['STRING', 'IDENTIFIER', 'REFERENCE'].includes(field.type);
      if (specializedSource && genericTarget && ruleScore < 0.90) {
        score -= 0.22;
        evidence.push({ technique: 'TYPE', score: 0.22, explanation: `Generic target type ${field.type} is penalized because the source is strongly detected as ${source.inferredType}.` });
      }

      score = Math.min(1, Math.max(0, score));

      if (score < 0.40) continue;

      const techniques = [...new Set(evidence.map((e) => e.technique))];
      const suggestedTransformations = suggestTransformations(source, field);
      const confidence = confidenceFor(score);
      const reason = evidence.length
        ? evidence.slice(0, 3).map((e) => e.explanation).join(' ')
        : 'Weak similarity signal only.';

      candidates.push({
        targetField: field.name,
        targetLabel: field.label,
        score: Math.round(score * 100) / 100,
        confidence,
        reason,
        fieldDef: field,
        evidence,
        techniques,
        suggestedTransformations
      });
    }

    return candidates.sort((a, b) => b.score - a.score);
  }
}
