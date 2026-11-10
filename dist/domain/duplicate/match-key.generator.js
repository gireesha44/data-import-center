/**
 * Match Key Generator for Deterministic Duplicate Detection
 */
import { createHash } from 'node:crypto';
export class MatchKeyGenerator {
    /**
     * Generates a collision-safe canonical key and deterministic SHA-256 hash.
     * Returns null if any required key field is null, undefined, or empty string.
     */
    static generateMatchKey(recordData, rule, fieldDefinitions = {}) {
        if (!rule || !rule.fields || rule.fields.length === 0) {
            return null;
        }
        const canonicalTokens = [];
        const displayTokens = [];
        for (const fieldName of rule.fields) {
            const rawValue = recordData[fieldName];
            if (rawValue === null || rawValue === undefined) {
                return null; // Missing key component -> cannot construct unambiguous identity key
            }
            const stringValue = String(rawValue).trim();
            if (stringValue === '' ||
                stringValue.includes('###INVALID###') ||
                stringValue.startsWith('###') ||
                stringValue.toUpperCase() === 'INVALID' ||
                stringValue.toUpperCase() === 'NULL' ||
                stringValue.toUpperCase() === 'UNDEFINED') {
                return null; // Invalid placeholder values are not valid unique identifiers
            }
            const fieldDef = fieldDefinitions[fieldName];
            const normalizedValue = this.normalizeValue(stringValue, rule, fieldDef);
            // Collision-safe canonical token encoding: "fieldName:length:value"
            const token = `${fieldName}:${normalizedValue.length}:${normalizedValue}`;
            canonicalTokens.push(token);
            displayTokens.push(normalizedValue);
        }
        const canonicalKey = canonicalTokens.join('|');
        const displayKey = displayTokens.join('|');
        const hash = createHash('sha256').update(canonicalKey, 'utf8').digest('hex');
        return {
            canonicalKey,
            displayKey,
            hash
        };
    }
    /**
     * Field-specific safe normalization
     */
    static normalizeValue(value, rule, fieldDef) {
        const isEmail = fieldDef?.type === 'EMAIL' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        const isPhone = fieldDef?.type === 'PHONE';
        if (rule.strategy === 'CASE_INSENSITIVE' || isEmail) {
            return value.trim().toLowerCase();
        }
        if (isPhone) {
            // Normalize phone: keep leading +, remove punctuation, spaces, dashes
            const cleaned = value.trim().replace(/[^0-9+]/g, '');
            return cleaned.toLowerCase();
        }
        // Default exact / composite trim
        return value.trim();
    }
}
//# sourceMappingURL=match-key.generator.js.map