/**
 * Unit Tests: Deterministic Mapping Suggestion Provider
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicMappingSuggestionProvider } from '../../../domain/mapping/mapping-suggestion.provider.js';
import { entitySchemaRegistry } from '../../../core/registry/entity-schema.registry.js';
describe('DeterministicMappingSuggestionProvider', () => {
    const provider = new DeterministicMappingSuggestionProvider();
    const contactsSchema = entitySchemaRegistry.getEntity('contacts');
    const makeSourceCol = (name, inferredType = 'STRING') => ({
        index: 0,
        originalName: name,
        normalizedName: name.toLowerCase().replace(/\s+/g, '_'),
        inferredType,
        sampleValues: [],
        emptyPercentage: 0
    });
    it('should auto-map exact matches with HIGH confidence', () => {
        const cols = [
            makeSourceCol('first_name', 'STRING'),
            makeSourceCol('last_name', 'STRING'),
            makeSourceCol('email', 'EMAIL')
        ];
        const result = provider.generateSuggestions(cols, contactsSchema);
        assert.equal(result.mappedCount, 3);
        assert.equal(result.suggestions[0].suggestedTargetField, 'first_name');
        assert.equal(result.suggestions[0].confidence, 'HIGH');
        assert.equal(result.suggestions[1].suggestedTargetField, 'last_name');
        assert.equal(result.suggestions[2].suggestedTargetField, 'email');
    });
    it('should map alias variations (e.g. email_address -> email, cell_phone -> phone)', () => {
        const cols = [
            makeSourceCol('email_address', 'EMAIL'),
            makeSourceCol('telephone', 'PHONE'),
            makeSourceCol('given_name', 'STRING'),
            makeSourceCol('organization', 'STRING')
        ];
        const result = provider.generateSuggestions(cols, contactsSchema);
        assert.equal(result.suggestions[0].suggestedTargetField, 'email');
        assert.equal(result.suggestions[0].confidence, 'HIGH');
        assert.equal(result.suggestions[1].suggestedTargetField, 'phone');
        assert.equal(result.suggestions[2].suggestedTargetField, 'first_name');
        assert.equal(result.suggestions[3].suggestedTargetField, 'company');
    });
    it('should map display label variations (e.g. First Name -> first_name)', () => {
        const cols = [
            makeSourceCol('First Name', 'STRING'),
            makeSourceCol('Email Address', 'EMAIL'),
            makeSourceCol('Company Name', 'STRING')
        ];
        const result = provider.generateSuggestions(cols, contactsSchema);
        assert.equal(result.suggestions[0].suggestedTargetField, 'first_name');
        assert.equal(result.suggestions[1].suggestedTargetField, 'email');
        assert.equal(result.suggestions[2].suggestedTargetField, 'company');
    });
    it('should resolve conflicts when 2 columns compete for the same target field', () => {
        const cols = [
            makeSourceCol('email', 'EMAIL'), // Exact match (score 1.0)
            makeSourceCol('email_address', 'EMAIL') // Alias match (score 0.90)
        ];
        const result = provider.generateSuggestions(cols, contactsSchema);
        // 'email' should win the target 'email'
        const match1 = result.suggestions.find((s) => s.sourceColumn === 'email');
        const match2 = result.suggestions.find((s) => s.sourceColumn === 'email_address');
        assert.equal(match1?.suggestedTargetField, 'email');
        assert.equal(match2?.suggestedTargetField, undefined); // Unassigned because 'email' is already taken
        assert.ok(match2?.alternatives.some((a) => a.targetField === 'email'));
    });
    it('should identify unmapped columns and provide alternatives', () => {
        const cols = [makeSourceCol('random_unrelated_column_xyz')];
        const result = provider.generateSuggestions(cols, contactsSchema);
        assert.equal(result.mappedCount, 0);
        assert.equal(result.unmappedCount, 1);
        assert.equal(result.suggestions[0].suggestedTargetField, undefined);
        assert.equal(result.suggestions[0].confidence, 'LOW');
    });
});
//# sourceMappingURL=mapping-suggestion.test.js.map