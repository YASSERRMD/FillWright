import { describe, it, expect } from 'vitest';
import { scanPage } from './index';

describe('Scanner', () => {
  it('should export scanPage function', () => {
    expect(typeof scanPage).toBe('function');
  });
});
