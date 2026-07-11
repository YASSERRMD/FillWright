import { describe, it, expect } from 'vitest';

describe('Scanner', () => {
  it('should export scanPage function', async () => {
    const { scanPage } = await import('../src/scanner');
    expect(typeof scanPage).toBe('function');
  });
});
