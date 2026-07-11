import { describe, it, expect } from 'vitest';
import { fillField, selectOption, toggle } from './index';

describe('MCP', () => {
  it('should export tool functions', () => {
    expect(typeof fillField).toBe('function');
    expect(typeof selectOption).toBe('function');
    expect(typeof toggle).toBe('function');
  });
});
