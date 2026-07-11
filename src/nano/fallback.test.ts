import { describe, it, expect } from 'vitest';
import { generateFallbackPlan } from './fallback';
import type { FormSchema } from '../types';

function createSchema(fields: Array<{ field_id: string; label: string; autocomplete?: string; type?: string }>): FormSchema {
  return {
    url: 'http://test.com',
    title: 'Test',
    fields: fields.map((f) => ({
      field_id: f.field_id,
      selector: `#${f.field_id}`,
      type: f.type ?? 'text',
      name: f.field_id,
      id: f.field_id,
      autocomplete: f.autocomplete ?? null,
      label: f.label,
      required: false,
      pattern: null,
      maxlength: null,
      min: null,
      max: null,
      step: null,
      options: null,
      currentValue: '',
      nearbyText: null,
    })),
    timestamp: Date.now(),
    tokenEstimate: 0,
  };
}

describe('generateFallbackPlan', () => {
  it('should match by autocomplete', () => {
    const schema = createSchema([
      { field_id: 'f1', label: 'Name', autocomplete: 'given-name' },
      { field_id: 'f2', label: 'Email', autocomplete: 'email' },
    ]);

    const profile: Record<string, string> = {
      'identity.givenName': 'Alice',
      'contact.email': 'alice@example.com',
    };

    const plan = generateFallbackPlan(schema, profile);
    expect(plan).toHaveLength(2);
    expect(plan[0]?.tool).toBe('fill_field');
    expect(plan[0]?.value).toBe('Alice');
    expect(plan[1]?.value).toBe('alice@example.com');
  });

  it('should match by label', () => {
    const schema = createSchema([
      { field_id: 'f1', label: 'First Name' },
      { field_id: 'f2', label: 'Phone Number' },
    ]);

    const profile: Record<string, string> = {
      'identity.givenName': 'Bob',
      'contact.phone': '555-1234',
    };

    const plan = generateFallbackPlan(schema, profile);
    expect(plan).toHaveLength(2);
    expect(plan[0]?.value).toBe('Bob');
    expect(plan[1]?.value).toBe('555-1234');
  });

  it('should skip empty profile values', () => {
    const schema = createSchema([
      { field_id: 'f1', label: 'First Name' },
    ]);

    const profile: Record<string, string> = {};

    const plan = generateFallbackPlan(schema, profile);
    expect(plan).toHaveLength(0);
  });

  it('should skip hidden fields', () => {
    const schema = {
      ...createSchema([{ field_id: 'f1', label: 'Name' }]),
      fields: [{
        ...createSchema([{ field_id: 'f1', label: 'Name' }]).fields[0]!,
        hidden: true,
      }],
    };

    const profile: Record<string, string> = { 'identity.fullName': 'Test' };

    const plan = generateFallbackPlan(schema, profile);
    expect(plan).toHaveLength(0);
  });
});
