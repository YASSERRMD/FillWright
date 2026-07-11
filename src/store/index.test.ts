import { describe, it, expect } from 'vitest';

describe('Store', () => {
  it('should export profile functions', async () => {
    const store = await import('../src/store');
    expect(typeof store.unlock).toBe('function');
    expect(typeof store.lock).toBe('function');
    expect(typeof store.getProfile).toBe('function');
  });
});
