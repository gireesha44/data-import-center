/**
 * Match Key Generator Unit Tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MatchKeyGenerator } from '../../../domain/duplicate/match-key.generator.js';
describe('MatchKeyGenerator', () => {
    const fields = {
        email: {
            name: 'email',
            label: 'Email',
            type: 'EMAIL',
            required: true
        },
        first_name: {
            name: 'first_name',
            label: 'First Name',
            type: 'STRING',
            required: true
        },
        last_name: {
            name: 'last_name',
            label: 'Last Name',
            type: 'STRING',
            required: true
        },
        phone: {
            name: 'phone',
            label: 'Phone',
            type: 'PHONE',
            required: false
        }
    };
    it('should generate deterministic key and hash for single email field (case-insensitive)', () => {
        const rule = {
            name: 'Email Unique',
            fields: ['email'],
            strategy: 'CASE_INSENSITIVE'
        };
        const res1 = MatchKeyGenerator.generateMatchKey({ email: 'John.Doe@Example.COM' }, rule, fields);
        const res2 = MatchKeyGenerator.generateMatchKey({ email: 'john.doe@example.com   ' }, rule, fields);
        assert.ok(res1);
        assert.ok(res2);
        assert.equal(res1.displayKey, 'john.doe@example.com');
        assert.equal(res2.displayKey, 'john.doe@example.com');
        assert.equal(res1.hash, res2.hash);
        assert.equal(res1.hash.length, 64); // SHA-256 hex string
    });
    it('should prevent collision on composite keys (e.g. AB + C vs A + BC)', () => {
        const rule = {
            name: 'Composite Name',
            fields: ['first_name', 'last_name'],
            strategy: 'COMPOSITE'
        };
        const key1 = MatchKeyGenerator.generateMatchKey({ first_name: 'AB', last_name: 'C' }, rule, fields);
        const key2 = MatchKeyGenerator.generateMatchKey({ first_name: 'A', last_name: 'BC' }, rule, fields);
        assert.ok(key1);
        assert.ok(key2);
        // Canonical length-prefixed encoding guarantees non-collision
        assert.notEqual(key1.canonicalKey, key2.canonicalKey);
        assert.notEqual(key1.hash, key2.hash);
    });
    it('should normalize phone numbers in match keys', () => {
        const rule = {
            name: 'Phone Match',
            fields: ['phone'],
            strategy: 'EXACT_MATCH'
        };
        const res1 = MatchKeyGenerator.generateMatchKey({ phone: '+1 (555) 019-2834' }, rule, fields);
        const res2 = MatchKeyGenerator.generateMatchKey({ phone: '+15550192834' }, rule, fields);
        assert.ok(res1);
        assert.ok(res2);
        assert.equal(res1.displayKey, '+15550192834');
        assert.equal(res1.hash, res2.hash);
    });
    it('should return null when any required match key field is null, undefined, or blank', () => {
        const rule = {
            name: 'Email Rule',
            fields: ['email'],
            strategy: 'CASE_INSENSITIVE'
        };
        assert.equal(MatchKeyGenerator.generateMatchKey({ email: null }, rule, fields), null);
        assert.equal(MatchKeyGenerator.generateMatchKey({ email: undefined }, rule, fields), null);
        assert.equal(MatchKeyGenerator.generateMatchKey({ email: '   ' }, rule, fields), null);
        assert.equal(MatchKeyGenerator.generateMatchKey({}, rule, fields), null);
        const compositeRule = {
            name: 'Composite Rule',
            fields: ['first_name', 'last_name'],
            strategy: 'COMPOSITE'
        };
        assert.equal(MatchKeyGenerator.generateMatchKey({ first_name: 'John', last_name: '' }, compositeRule, fields), null);
    });
});
//# sourceMappingURL=match-key-generator.test.js.map