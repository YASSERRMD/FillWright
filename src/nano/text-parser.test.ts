import { describe, it, expect } from 'vitest';
import { parseProfileText, profileToFlat, getExtractedSummary } from './text-parser';

describe('parseProfileText', () => {
  it('extracts full profile from a paragraph', () => {
    const text = `I am Mohamed Yasser, a Solutions Architect working at TechCorp.
My email is mohamed@techcorp.com and my phone is +971-50-123-4567.
I live at 123 Sheikh Zayed Road, Dubai, UAE.
My passport is PA12345678 and my national ID is 784-1234-5678901-2.`;

    const profile = parseProfileText(text);

    expect(profile.identity.givenName).toBe('Mohamed');
    expect(profile.identity.familyName).toBe('Yasser');
    expect(profile.identity.fullName).toBe('Mohamed Yasser');
    expect(profile.contact.email).toBe('mohamed@techcorp.com');
    expect(profile.contact.phone).toContain('971');
    expect(profile.contact.addresses[0]).toContain('Sheikh Zayed Road');
    expect(profile.employment.employer).toBe('TechCorp');
    expect(profile.documents.passport).toBe('PA12345678');
    expect(profile.documents.nationalId).toBe('784-1234-5678901-2');
  });

  it('extracts name from "my name is" prefix', () => {
    const profile = parseProfileText('My name is Alice Johnson. email: alice@test.com');
    expect(profile.identity.givenName).toBe('Alice');
    expect(profile.identity.familyName).toBe('Johnson');
    expect(profile.contact.email).toBe('alice@test.com');
  });

  it('extracts work info from "i work at X as Y"', () => {
    const profile = parseProfileText('I work at Google as a Software Engineer in the Cloud department.');
    expect(profile.employment.employer).toBe('Google');
    expect(profile.employment.jobTitle).toBe('Software Engineer');
    expect(profile.employment.department).toBe('Cloud');
  });

  it('extracts multiple addresses', () => {
    const text = `I live at 456 Oak Avenue, New York, NY 10001.
My work address is 789 Pine Street, Manhattan.`;
    const profile = parseProfileText(text);
    expect(profile.contact.addresses.length).toBeGreaterThanOrEqual(1);
  });

  it('extracts custom fields like nationality and language', () => {
    const text = `I am Ahmed. Nationality: Emirati. Language: Arabic.`;
    const profile = parseProfileText(text);
    expect(profile.custom.nationality).toBe('Emirati');
    expect(profile.custom.preferredLanguage).toBe('Arabic');
  });

  it('handles minimal input gracefully', () => {
    const profile = parseProfileText('just some random text');
    expect(profile.identity.givenName).toBe('');
    expect(profile.contact.email).toBe('');
  });
});

describe('profileToFlat', () => {
  it('flattens a profile to key-value pairs', () => {
    const text = 'I am Bob Smith. Email: bob@test.com. Phone: 555-1234.';
    const profile = parseProfileText(text);
    const flat = profileToFlat(profile);

    expect(flat['identity.givenName']).toBe('Bob');
    expect(flat['identity.familyName']).toBe('Smith');
    expect(flat['contact.email']).toBe('bob@test.com');
    expect(flat['contact.phone']).toBe('555-1234');
  });
});

describe('getExtractedSummary', () => {
  it('returns human-readable summary of extracted fields', () => {
    const text = 'I am Carol White. Email: carol@test.com. Works at Acme as Designer.';
    const profile = parseProfileText(text);
    const summary = getExtractedSummary(profile);

    expect(summary.some((s) => s.includes('Carol White'))).toBe(true);
    expect(summary.some((s) => s.includes('carol@test.com'))).toBe(true);
    expect(summary.some((s) => s.includes('Acme'))).toBe(true);
  });
});
