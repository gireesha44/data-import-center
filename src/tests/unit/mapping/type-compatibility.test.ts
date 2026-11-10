/**
 * Unit Tests: Type Compatibility Evaluator
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TypeCompatibilityEvaluator } from '../../../domain/mapping/type-compatibility.evaluator.js';

describe('TypeCompatibilityEvaluator', () => {
  it('should mark matching types as COMPATIBLE', () => {
    assert.equal(TypeCompatibilityEvaluator.evaluate('STRING', 'STRING'), 'COMPATIBLE');
    assert.equal(TypeCompatibilityEvaluator.evaluate('EMAIL', 'EMAIL'), 'COMPATIBLE');
    assert.equal(TypeCompatibilityEvaluator.evaluate('NUMBER', 'NUMBER'), 'COMPATIBLE');
    assert.equal(TypeCompatibilityEvaluator.evaluate('DECIMAL', 'DECIMAL'), 'COMPATIBLE');
    assert.equal(TypeCompatibilityEvaluator.evaluate('DATE', 'DATE'), 'COMPATIBLE');
    assert.equal(TypeCompatibilityEvaluator.evaluate('BOOLEAN', 'BOOLEAN'), 'COMPATIBLE');
  });

  it('should mark numeric conversions as COMPATIBLE', () => {
    assert.equal(TypeCompatibilityEvaluator.evaluate('NUMBER', 'DECIMAL'), 'COMPATIBLE');
    assert.equal(TypeCompatibilityEvaluator.evaluate('DECIMAL', 'NUMBER'), 'COMPATIBLE');
  });

  it('should mark any source type to STRING target as COMPATIBLE', () => {
    assert.equal(TypeCompatibilityEvaluator.evaluate('NUMBER', 'STRING'), 'COMPATIBLE');
    assert.equal(TypeCompatibilityEvaluator.evaluate('BOOLEAN', 'STRING'), 'COMPATIBLE');
    assert.equal(TypeCompatibilityEvaluator.evaluate('DATE', 'STRING'), 'COMPATIBLE');
    assert.equal(TypeCompatibilityEvaluator.evaluate('EMAIL', 'STRING'), 'COMPATIBLE');
  });

  it('should mark STRING source requiring parsing as TRANSFORM_REQUIRED', () => {
    assert.equal(TypeCompatibilityEvaluator.evaluate('STRING', 'NUMBER'), 'TRANSFORM_REQUIRED');
    assert.equal(TypeCompatibilityEvaluator.evaluate('STRING', 'DECIMAL'), 'TRANSFORM_REQUIRED');
    assert.equal(TypeCompatibilityEvaluator.evaluate('STRING', 'DATE'), 'TRANSFORM_REQUIRED');
    assert.equal(TypeCompatibilityEvaluator.evaluate('STRING', 'BOOLEAN'), 'TRANSFORM_REQUIRED');
    assert.equal(TypeCompatibilityEvaluator.evaluate('STRING', 'ENUM'), 'TRANSFORM_REQUIRED');
  });

  it('should mark incompatible conversions as INCOMPATIBLE', () => {
    assert.equal(TypeCompatibilityEvaluator.evaluate('EMAIL', 'NUMBER'), 'INCOMPATIBLE');
    assert.equal(TypeCompatibilityEvaluator.evaluate('PHONE', 'DECIMAL'), 'INCOMPATIBLE');
  });

  it('should return UNKNOWN when source type is UNKNOWN', () => {
    assert.equal(TypeCompatibilityEvaluator.evaluate('UNKNOWN', 'STRING'), 'UNKNOWN');
  });
});
