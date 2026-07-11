import { describe, it, expect, beforeEach } from 'vitest';
import { execute } from './executor';

describe('MCP Executor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return error for unknown tool', () => {
    const result = execute('unknown_tool' as never, {});
    expect(result).toEqual({ ok: false, error: 'Unknown tool: unknown_tool' });
  });

  it('should list_fields', () => {
    const result = execute('list_fields', {});
    expect(result).toHaveProperty('ok', true);
    expect(result).toHaveProperty('fields');
    expect(result).toHaveProperty('count');
  });

  it('should return error for fill_field with missing args', () => {
    const result = execute('fill_field', {});
    expect(result).toEqual({ ok: false, error: 'Missing required args: field_id, value' });
  });

  it('should return error for select_option with missing args', () => {
    const result = execute('select_option', {});
    expect(result).toEqual({ ok: false, error: 'Missing required args: field_id, value' });
  });

  it('should return error for toggle with missing args', () => {
    const result = execute('toggle', {});
    expect(result).toEqual({ ok: false, error: 'Missing required args: field_id, state (boolean)' });
  });

  it('should read_validation_errors', () => {
    const result = execute('read_validation_errors', {});
    expect(result).toHaveProperty('ok', true);
    expect(result).toHaveProperty('errors');
  });

  it('should return pending for submit', () => {
    const result = execute('submit', {});
    expect(result).toEqual({ ok: true, applied_value: 'pending-confirmation' });
  });

  it('should return error for fill_many with non-array items', () => {
    const result = execute('fill_many', { items: 'not-an-array' });
    expect(result).toEqual({ ok: false, error: 'Missing required arg: items (array)' });
  });

  it('should fill_many with empty array', () => {
    const result = execute('fill_many', { items: [] });
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(0);
  });
});
