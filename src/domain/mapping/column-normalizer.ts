/**
 * Column Normalizer & Type Inference Service
 */

import { FieldDataType } from '../../core/registry/entity-schema.registry.js';
import { SourceColumn } from '../../core/types/mapping.types.js';
import { ParsedDataset } from '../../core/types/parser.types.js';

export class ColumnNormalizer {
  /**
   * Deterministically normalizes a column or field name to snake_case lowercase tokens
   * e.g., "First Name", "firstName", "first-name", "FIRST_NAME", "First   Name!" -> "first_name"
   */
  public static normalize(name: string): string {
    if (!name || typeof name !== 'string') return '';

    return name
      // Split camelCase or PascalCase (e.g. "firstName" -> "first Name", "CustomerID" -> "Customer ID")
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      // Replace non-alphanumeric characters with spaces
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .toLowerCase()
      // Collapse multiple spaces into single underscore
      .replace(/\s+/g, '_');
  }

  /**
   * Extracts token array from normalized string for multi-token fuzzy matching
   */
  public static getTokens(name: string): string[] {
    const normalized = this.normalize(name);
    if (!normalized) return [];
    return normalized.split('_').filter(Boolean);
  }

  /**
   * Computes Levenshtein edit distance between two strings
   */
  public static levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1, // deletion
          d[i][j - 1] + 1, // insertion
          d[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return d[m][n];
  }

  /**
   * Calculates similarity ratio (0.0 to 1.0) between two strings
   */
  public static similarityRatio(a: string, b: string): number {
    const normA = this.normalize(a);
    const normB = this.normalize(b);
    if (normA === normB) return 1.0;
    if (!normA || !normB) return 0.0;

    const maxLen = Math.max(normA.length, normB.length);
    const distance = this.levenshteinDistance(normA, normB);
    return Math.max(0, (maxLen - distance) / maxLen);
  }

  /**
   * Infers primitive/semantic field data type from sample cell values
   */
  public static inferDataType(sampleValues: unknown[]): FieldDataType {
    const nonNullValues = sampleValues
      .filter((v) => v !== null && v !== undefined && v !== '')
      .map((v) => (typeof v === 'string' ? v.trim() : v));

    if (nonNullValues.length === 0) {
      return 'STRING';
    }

    let booleanCount = 0;
    let integerCount = 0;
    let decimalCount = 0;
    let dateCount = 0;
    let emailCount = 0;
    let phoneCount = 0;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const phoneRegex = /^(\+?\d{1,4}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?[\d\s-]{6,14}\d$/;
    const booleanStrings = new Set(['true', 'false', 'yes', 'no', '1', '0', 'y', 'n', 't', 'f']);

    for (const val of nonNullValues) {
      if (typeof val === 'boolean') {
        booleanCount++;
        continue;
      }

      if (typeof val === 'number') {
        if (Number.isInteger(val)) {
          integerCount++;
        } else {
          decimalCount++;
        }
        continue;
      }

      const strVal = String(val);
      const isDatePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(strVal) || /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(strVal);
      const parsedDate = isDatePattern ? Date.parse(strVal) : NaN;

      if (booleanStrings.has(strVal.toLowerCase())) {
        booleanCount++;
      } else if (emailRegex.test(strVal)) {
        emailCount++;
      } else if (!isNaN(parsedDate)) {
        dateCount++;
      } else if (phoneRegex.test(strVal) && strVal.replace(/\D/g, '').length >= 7 && !strVal.startsWith('20') && !strVal.startsWith('19')) {
        phoneCount++;
      } else if (phoneRegex.test(strVal) && (strVal.startsWith('+') || strVal.includes('(') || strVal.replace(/\D/g, '').length >= 10)) {
        phoneCount++;
      } else if (!isNaN(Number(strVal)) && strVal !== '') {
        if (strVal.includes('.')) {
          decimalCount++;
        } else {
          integerCount++;
        }
      }
    }

    const total = nonNullValues.length;
    const threshold = 0.7; // 70% threshold

    if (emailCount / total >= threshold) return 'EMAIL';
    if (phoneCount / total >= threshold) return 'PHONE';
    if (booleanCount / total >= threshold) return 'BOOLEAN';
    if ((integerCount + decimalCount) / total >= threshold) {
      return decimalCount > 0 ? 'DECIMAL' : 'NUMBER';
    }
    if (dateCount / total >= threshold) return 'DATE';

    return 'STRING';
  }

  /**
   * Constructs SourceColumn models from a ParsedDataset with metrics and type inference
   */
  public static extractSourceColumns(dataset: ParsedDataset, maxSamplesPerColumn = 10): SourceColumn[] {
    const sourceColumns: SourceColumn[] = [];

    for (let i = 0; i < dataset.normalizedHeaders.length; i++) {
      const headerInfo = dataset.normalizedHeaders[i];
      const originalName = headerInfo.original;
      const normalizedName = this.normalize(originalName);

      const allValues = dataset.rows.map((row) => row.values[headerInfo.normalized]);
      const nonNullValues = allValues.filter((v) => v !== null && v !== undefined && v !== '');
      const distinctSet = new Set(nonNullValues.map((v) => String(v)));

      const sampleValues = nonNullValues.slice(0, maxSamplesPerColumn);
      const inferredType = this.inferDataType(sampleValues);

      const nullCount = allValues.length - nonNullValues.length;
      const emptyPercentage = allValues.length > 0 ? (nullCount / allValues.length) * 100 : 0;

      sourceColumns.push({
        index: i,
        originalName,
        normalizedName,
        inferredType,
        sampleValues,
        emptyPercentage: Math.round(emptyPercentage * 100) / 100,
        statistics: {
          totalSamples: allValues.length,
          distinctCount: distinctSet.size,
          nullCount
        }
      });
    }

    return sourceColumns;
  }

  /**
   * Generates a comprehensive column data profile for parsed dataset
   */
  public static profileDataset(
    dataset: ParsedDataset,
    targetSchemaFields?: Record<string, { name: string; label: string; aliases?: string[]; type: string }>
  ): Record<string, unknown>[] {
    const totalRows = dataset.rowCount;
    return dataset.normalizedHeaders.map((headerInfo) => {
      const colKey = headerInfo.normalized;
      const allValues = dataset.rows.map((r) => r.values[colKey]);
      const nonNullValues = allValues.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
      const missingCount = totalRows - nonNullValues.length;
      const missingPercentage = totalRows > 0 ? Math.round((missingCount / totalRows) * 10000) / 100 : 0;
      const uniqueSet = new Set(nonNullValues.map((v) => String(v)));
      const uniqueCount = uniqueSet.size;
      const duplicateCount = Math.max(0, nonNullValues.length - uniqueCount);
      const sampleValues = nonNullValues.slice(0, 10);
      const detectedType = this.inferDataType(sampleValues);

      // Validate cell format against inferred detected type to get valid/invalid breakdown
      let validCount = 0;
      let invalidCount = 0;

      for (const val of nonNullValues) {
        const strVal = String(val).trim();
        let isValidForType = true;

        if (detectedType === 'EMAIL') {
          isValidForType = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(strVal);
        } else if (detectedType === 'NUMBER' || detectedType === 'DECIMAL') {
          const cleaned = strVal.replace(/[$€£¥, ]/g, '');
          isValidForType = !isNaN(Number(cleaned)) && Number.isFinite(Number(cleaned));
        } else if (detectedType === 'DATE') {
          const isDatePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(strVal) || /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(strVal);
          isValidForType = isDatePattern && !isNaN(Date.parse(strVal));
        }

        if (isValidForType) validCount++;
        else invalidCount++;
      }

      const formatConsistency = nonNullValues.length > 0
        ? Math.round((validCount / nonNullValues.length) * 10000) / 100
        : 100;

      // Match potential target fields if schema is provided
      const potentialTargetFields: { fieldName: string; label: string; score: number }[] = [];
      if (targetSchemaFields) {
        for (const fieldDef of Object.values(targetSchemaFields)) {
          let highestScore = this.similarityRatio(headerInfo.original, fieldDef.name);
          highestScore = Math.max(highestScore, this.similarityRatio(headerInfo.original, fieldDef.label));
          if (fieldDef.aliases) {
            for (const alias of fieldDef.aliases) {
              highestScore = Math.max(highestScore, this.similarityRatio(headerInfo.original, alias));
            }
          }
          if (highestScore >= 0.4) {
            potentialTargetFields.push({
              fieldName: fieldDef.name,
              label: fieldDef.label,
              score: Math.round(highestScore * 100) / 100
            });
          }
        }
        potentialTargetFields.sort((a, b) => b.score - a.score);
      }

      return {
        originalName: headerInfo.original,
        normalizedName: headerInfo.normalized,
        detectedType,
        totalRows,
        nonEmptyCount: nonNullValues.length,
        missingCount,
        missingPercentage,
        validCount,
        invalidCount,
        formatConsistency,
        uniqueCount,
        duplicateCount,
        sampleValues,
        potentialTargetFields
      };
    });
  }
}

