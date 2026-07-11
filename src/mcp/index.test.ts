import { describe, it, expect } from 'vitest';

describe('MCP', () => {
  it('should export tool functions', async () => {
    const mcp = await import('../src/mcp');
    expect(typeof mcp.fill_field).toBe('function');
    expect(typeof mcp.select_option).toBe('function');
    expect(typeof mcp.toggle).toBe('function');
  });
});
