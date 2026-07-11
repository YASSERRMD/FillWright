import { describe, it, expect, beforeEach } from 'vitest';
import {
  unlock,
  lock,
  getProfile,
  setField,
  getField,
  exportProfile,
  importProfile,
  getFlattenedProfile,
} from './index';

describe('Store', () => {
  beforeEach(() => {
    lock();
  });

  it('should unlock with any passphrase when no profile exists', async () => {
    const result = await unlock('test-passphrase');
    expect(result).toBe(true);
  });

  it('should return profile when unlocked', async () => {
    await unlock('test-passphrase');
    const profile = getProfile();
    expect(profile).not.toBeNull();
    expect(profile?.identity).toBeDefined();
  });

  it('should return null when locked', () => {
    lock();
    const profile = getProfile();
    expect(profile).toBeNull();
  });

  it('should set and get field values', async () => {
    await unlock('test-passphrase');
    setField('identity.givenName', 'John');
    expect(getField('identity.givenName')).toBe('John');
  });

  it('should return false when setting field while locked', () => {
    lock();
    const result = setField('identity.givenName', 'John');
    expect(result).toBe(false);
  });

  it('should export profile as JSON when unlocked', async () => {
    await unlock('test-passphrase');
    setField('identity.givenName', 'Jane');
    const json = exportProfile();
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json!);
    expect(parsed.identity.givenName).toBe('Jane');
  });

  it('should return null when exporting while locked', () => {
    lock();
    const json = exportProfile();
    expect(json).toBeNull();
  });

  it('should import profile from JSON', async () => {
    await unlock('test-passphrase');
    const profileJson = JSON.stringify({
      identity: { givenName: 'Imported', familyName: 'User', fullName: 'Imported User', preferredName: 'Imported' },
      contact: { email: '', phone: '', addresses: [] },
      documents: {},
      employment: {},
      custom: {},
    });
    const result = await importProfile(profileJson);
    expect(result).toBe(true);
    expect(getField('identity.givenName')).toBe('Imported');
  });

  it('should return flattened profile', async () => {
    await unlock('test-passphrase');
    setField('identity.givenName', 'Alice');
    setField('contact.email', 'alice@example.com');
    const flat = getFlattenedProfile();
    expect(flat['identity.givenName']).toBe('Alice');
    expect(flat['contact.email']).toBe('alice@example.com');
  });

  it('should return empty flattened profile when locked', () => {
    lock();
    const flat = getFlattenedProfile();
    expect(Object.keys(flat)).toHaveLength(0);
  });
});
