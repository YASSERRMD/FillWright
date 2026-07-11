import { describe, it, expect } from 'vitest';
import { fill_field, select_option, toggle } from './index';

describe('MCP', () => {
  it('should export tool functions', () => {
    expect(typeof fill_field).toBe('function');
    expect(typeof select_option).toBe('function');
    expect(typeof toggle).toBe('function');
  });
});
