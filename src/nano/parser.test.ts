import { describe, it, expect } from 'vitest';
import { stripMarkdownFences, validateStep, filterByConfidence, parseFillPlan } from './parser';

describe('stripMarkdownFences', () => {
  it('should strip json code fences', () => {
    const input = '```json\n[{"tool":"fill_field"}]\n```';
    expect(stripMarkdownFences(input)).toBe('[{"tool":"fill_field"}]');
  });

  it('should strip plain code fences', () => {
    const input = '```\n[{"tool":"fill_field"}]\n```';
    expect(stripMarkdownFences(input)).toBe('[{"tool":"fill_field"}]');
  });

  it('should strip tilde fences', () => {
    const input = '~~~json\n[{"tool":"fill_field"}]\n~~~';
    expect(stripMarkdownFences(input)).toBe('[{"tool":"fill_field"}]');
  });

  it('should handle already clean JSON', () => {
    const input = '[{"tool":"fill_field"}]';
    expect(stripMarkdownFences(input)).toBe('[{"tool":"fill_field"}]');
  });

  it('should trim whitespace', () => {
    const input = '  [{"tool":"fill_field"}]  ';
    expect(stripMarkdownFences(input)).toBe('[{"tool":"fill_field"}]');
  });
});

describe('validateStep', () => {
  it('should accept valid fill_field step', () => {
    expect(validateStep({ tool: 'fill_field', field_id: 'f1', value: 'hello', confidence: 0.9 })).toBe(true);
  });

  it('should accept valid select_option step', () => {
    expect(validateStep({ tool: 'select_option', field_id: 'f1', value: 'red', confidence: 0.8 })).toBe(true);
  });

  it('should accept valid toggle step', () => {
    expect(validateStep({ tool: 'toggle', field_id: 'f1', value: 'true', confidence: 0.95 })).toBe(true);
  });

  it('should reject invalid tool', () => {
    expect(validateStep({ tool: 'unknown', field_id: 'f1', value: 'v', confidence: 0.9 })).toBe(false);
  });

  it('should reject missing field_id', () => {
    expect(validateStep({ tool: 'fill_field', value: 'v', confidence: 0.9 })).toBe(false);
  });

  it('should reject non-object', () => {
    expect(validateStep(null)).toBe(false);
    expect(validateStep('string')).toBe(false);
    expect(validateStep(42)).toBe(false);
  });
});

describe('filterByConfidence', () => {
  it('should filter steps below threshold', () => {
    const plan = [
      { tool: 'fill_field', field_id: 'f1', value: 'a', confidence: 0.9 },
      { tool: 'fill_field', field_id: 'f2', value: 'b', confidence: 0.3 },
      { tool: 'fill_field', field_id: 'f3', value: 'c', confidence: 0.5 },
    ];
    const result = filterByConfidence(plan, 0.5);
    expect(result).toHaveLength(2);
    expect(result[0]?.field_id).toBe('f1');
    expect(result[1]?.field_id).toBe('f3');
  });
});

describe('parseFillPlan', () => {
  it('should parse valid JSON array', () => {
    const raw = '[{"tool":"fill_field","field_id":"f1","value":"hello","confidence":0.9}]';
    const result = parseFillPlan(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan).toHaveLength(1);
    }
  });

  it('should strip fences and parse', () => {
    const raw = '```json\n[{"tool":"fill_field","field_id":"f1","value":"hello","confidence":0.9}]\n```';
    const result = parseFillPlan(raw);
    expect(result.ok).toBe(true);
  });

  it('should reject invalid JSON', () => {
    const result = parseFillPlan('not json');
    expect(result.ok).toBe(false);
  });

  it('should reject non-array', () => {
    const result = parseFillPlan('{"not": "array"}');
    expect(result.ok).toBe(false);
  });

  it('should reject when no valid steps', () => {
    const raw = '[{"tool":"bad","field_id":"f1","value":"v","confidence":0.9}]';
    const result = parseFillPlan(raw);
    expect(result.ok).toBe(false);
  });
});
