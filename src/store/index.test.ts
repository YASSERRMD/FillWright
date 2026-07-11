import { describe, it, expect } from 'vitest';
import { unlock, lock, getProfile } from './index';

describe('Store', () => {
  it('should export profile functions', () => {
    expect(typeof unlock).toBe('function');
    expect(typeof lock).toBe('function');
    expect(typeof getProfile).toBe('function');
  });
});
