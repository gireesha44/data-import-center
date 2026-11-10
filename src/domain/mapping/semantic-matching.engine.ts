/**
 * Local semantic / embedding-style matching engine.
 *
 * This intentionally has no external dependency or network call. It builds a
 * small semantic feature vector from normalized tokens, business synonyms and
 * character n-grams, then compares source headers with target names, labels
 * and aliases. The engine is deterministic, explainable and safe to use as a
 * fallback when an external AI/embedding provider is not configured.
 */

import { ColumnNormalizer } from './column-normalizer.js';

const CONCEPT_GROUPS: Record<string, string[]> = {
  email: ['email', 'mail', 'e-mail', 'electronicmail', 'contactemail', 'billingemail'],
  phone: ['phone', 'telephone', 'tel', 'mobile', 'cell', 'contactnumber', 'phonenumber'],
  identifier: ['id', 'identifier', 'number', 'no', 'code', 'key', 'reference', 'ref'],
  name: ['name', 'fullname', 'title'],
  first_name: ['first', 'firstname', 'given', 'givenname', 'forename'],
  last_name: ['last', 'lastname', 'surname', 'family', 'familyname'],
  company: ['company', 'organization', 'organisation', 'org', 'business', 'employer', 'firm', 'account'],
  customer: ['customer', 'client', 'buyer', 'account'],
  employee: ['employee', 'staff', 'worker', 'personnel', 'associate'],
  department: ['department', 'dept', 'division', 'team', 'unit'],
  manager: ['manager', 'owner', 'supervisor', 'lead', 'assignee'],
  address: ['address', 'location', 'street', 'city', 'state', 'country', 'postal', 'zip'],
  amount: ['amount', 'total', 'value', 'price', 'cost', 'fee', 'balance'],
  date: ['date', 'day', 'issued', 'created', 'updated', 'due', 'expiry', 'effective'],
  status: ['status', 'state', 'stage', 'condition'],
  category: ['category', 'type', 'class', 'segment', 'group', 'classification'],
  description: ['description', 'details', 'notes', 'comment', 'remarks', 'summary'],
  currency: ['currency', 'money', 'ccy'],
  quantity: ['quantity', 'qty', 'count', 'units', 'volume']
};

const TOKEN_TO_CONCEPT = new Map<string, string>();
for (const [concept, tokens] of Object.entries(CONCEPT_GROUPS)) {
  for (const token of tokens) TOKEN_TO_CONCEPT.set(ColumnNormalizer.normalize(token), concept);
}

function normalizedTokens(value: string): string[] {
  return ColumnNormalizer.getTokens(value).map((token) => ColumnNormalizer.normalize(token)).filter(Boolean);
}

function conceptSet(value: string): Set<string> {
  const result = new Set<string>();
  for (const token of normalizedTokens(value)) {
    result.add(TOKEN_TO_CONCEPT.get(token) || token);
  }
  return result;
}

function trigrams(value: string): Set<string> {
  const normalized = ColumnNormalizer.normalize(value).replace(/_/g, ' ');
  const compact = normalized.replace(/\s+/g, '');
  const result = new Set<string>();
  if (compact.length < 3) {
    if (compact) result.add(compact);
    return result;
  }
  for (let i = 0; i <= compact.length - 3; i++) result.add(compact.slice(i, i + 3));
  return result;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  return intersection / Math.min(a.size, b.size);
}

export interface SemanticMatchEvidence {
  score: number;
  explanation: string;
  matchedConcepts: string[];
}

export class SemanticMatchingEngine {
  public static score(source: string, targetCandidates: string[]): SemanticMatchEvidence {
    const sourceConcepts = conceptSet(source);
    const sourceTrigrams = trigrams(source);

    let best = 0;
    let bestTarget = '';
    let bestConcepts: string[] = [];

    for (const target of targetCandidates) {
      const targetConcepts = conceptSet(target);
      const targetTrigrams = trigrams(target);
      const conceptScore = Math.max(jaccard(sourceConcepts, targetConcepts), overlapCoefficient(sourceConcepts, targetConcepts));
      const characterScore = jaccard(sourceTrigrams, targetTrigrams);
      const combined = conceptScore * 0.80 + characterScore * 0.20;

      if (combined > best) {
        best = combined;
        bestTarget = target;
        bestConcepts = [...sourceConcepts].filter((concept) => targetConcepts.has(concept));
      }
    }

    const rounded = Math.round(Math.min(1, best) * 100) / 100;
    const explanation = rounded > 0
      ? `Semantic vector similarity to '${bestTarget}' is ${Math.round(rounded * 100)}%${bestConcepts.length ? `; shared concepts: ${bestConcepts.join(', ')}` : ''}`
      : 'No meaningful semantic similarity detected';

    return { score: rounded, explanation, matchedConcepts: bestConcepts };
  }
}
