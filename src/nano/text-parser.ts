import type { Profile } from '../types/profile';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\+?\d[\d\s()-]{6,}\d/g;

function findAll(text: RegExp, input: string): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = text.exec(input)) !== null) {
    matches.push(m[0].trim());
  }
  return matches;
}

function extractEmail(text: string): string {
  return findAll(EMAIL_RE, text)[0] ?? '';
}

function extractPhone(text: string): string {
  const phones = findAll(PHONE_RE, text);
  const cleaned = phones
    .map((p) => p.replace(/[(]/g, '').replace(/[)]/g, '').trim())
    .filter((p) => p.replace(/\D/g, '').length >= 7);
  return cleaned[0] ?? '';
}

function extractName(text: string): { given: string; family: string; full: string } {
  // Try explicit patterns first: "I am X", "My name is X", "Name: X"
  // Use case-sensitive matching to stop at first lowercase-starting word
  const explicitMatch = text.match(
    /(?:I\s+am|My\s+name\s+is|I'm|Name[:\s]+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/
  );
  if (explicitMatch) {
    const name = (explicitMatch[1] ?? '').trim();
    return parseFullName(name);
  }

  // Try first sentence if it looks like a name
  const sentences = text.split(/[.!?\n]+/);
  const first = sentences[0]?.trim() ?? '';
  const words = first.split(/\s+/);
  if (words.length >= 2 && words.length <= 4) {
    const allCapitalized = words.every((w) => /^[A-Z]/.test(w) && !/^(i|a|an|the|at|in|on|for|as|of|to)$/i.test(w));
    if (allCapitalized) {
      return parseFullName(words.join(' '));
    }
  }

  return { given: '', family: '', full: '' };
}

function parseFullName(name: string): { given: string; family: string; full: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return { given: '', family: '', full: '' };
  const first = parts[0] ?? '';
  const last = parts[parts.length - 1] ?? '';
  if (parts.length === 1) return { given: first, family: '', full: first };
  return {
    given: first,
    family: last,
    full: parts.join(' '),
  };
}

function extractEmployment(text: string): { employer: string; jobTitle: string; department: string } {
  let employer = '';
  let jobTitle = '';
  let department = '';

  // Employer: "working at X", "works at X", "work at X", "employed at X"
  const empMatch = text.match(
    /(?:working|works|work|employed|hired)\s+(?:at|for)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9.\s&]+?)(?:\s*,|\s*\.|\s+as\b|\s+where|\s+in\b|\s+and\b|$)/i
  );
  if (empMatch) {
    employer = (empMatch[1] ?? '').replace(/[.,;!?]+$/, '').trim();
  }

  // Job title: "as a X", "as an X", "working as X", "job title: X", "position: X"
  const titleMatch = text.match(
    /(?:working\s+)?as\s+(?:a|an|the)?\s*([A-Za-z][A-Za-z\s]+?)(?:\s+at\b|\s+for\b|\s+in\b|\s*,|\s*\.|$)/i
  );
  if (titleMatch) {
    jobTitle = (titleMatch[1] ?? '').replace(/[.,;!?]+$/, '').trim();
  }

  if (!jobTitle) {
    const titleMatch2 = text.match(/(?:job\s*title|position|role)[:\s]+([A-Za-z][A-Za-z\s]+?)(?:\s*,|\s*\.|$)/i);
    if (titleMatch2) {
      jobTitle = (titleMatch2[1] ?? '').replace(/[.,;!?]+$/, '').trim();
    }
  }

  // Department: "in the X department", "department: X"
  const deptMatch = text.match(/(?:in\s+(?:the\s+)?)(\w+)\s+department/i)
    ?? text.match(/department[:\s]+([A-Za-z][A-Za-z\s]+?)(?:\s*,|\s*\.|$)/i);
  if (deptMatch) {
    department = (deptMatch[1] ?? '').replace(/[.,;!?]+$/, '').trim();
  }

  return { employer, jobTitle, department };
}

function extractAddress(text: string): { address: string; country: string } {
  const addressKeywords = /\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|circle|cir|trail|trl)\b/i;

  const sentences = text.split(/[.!?\n]+/);
  for (const s of sentences) {
    if (addressKeywords.test(s)) {
      return { address: s.trim(), country: '' };
    }
  }

  return { address: '', country: '' };
}

function extractCountry(text: string): string {
  const countryMatch = text.match(
    /(?:country(?:\s+of\s+residence)?|nation|based\s+in|located\s+in|from|living\s+in)[:\s]*([A-Za-z][A-Za-z\s]{1,30}?)(?:\s*,|\s*\.|\s+where|\s+and\b|$)/i
  );
  if (countryMatch) return (countryMatch[1] ?? '').replace(/[.,;!?]+$/, '').trim();
  return '';
}

function extractDocuments(text: string): Record<string, string> {
  const docs: Record<string, string> = {};

  const passportMatch = text.match(/passport(?:\s*(?:number|#|no|num|is|:))?\s*([A-Za-z0-9]{6,12})/i);
  if (passportMatch) docs.passport = passportMatch[1] ?? '';

  const nationalIdMatch = text.match(/(?:national\s*id|id\s*number|id\s*#)(?:\s*(?:is|:))?\s*([A-Za-z0-9-]{6,20})/i);
  if (nationalIdMatch) docs.nationalId = nationalIdMatch[1] ?? '';

  const emiratesMatch = text.match(/(?:emirates\s*id|eid)[:\s]*([A-Za-z0-9-]{8,20})/i);
  if (emiratesMatch) docs.emiratesId = emiratesMatch[1] ?? '';

  return docs;
}

function extractCustom(text: string): Record<string, string> {
  const custom: Record<string, string> = {};

  const langMatch = text.match(/(?:language:?\s*)([^,.\n]+)/i);
  if (langMatch) custom.preferredLanguage = (langMatch[1] ?? '').trim();

  const natMatch = text.match(/(?:nationality:?\s*)([^,.\n]+)/i);
  if (natMatch) custom.nationality = (natMatch[1] ?? '').trim();

  const dobMatch = text.match(/(?:dob|date\s+of\s+birth|born|birthday)[:\s]*(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})/i);
  if (dobMatch) custom.dateOfBirth = dobMatch[1] ?? '';

  return custom;
}

export function parseProfileText(text: string): Profile {
  const name = extractName(text);
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const { address, country } = extractAddress(text);
  const extractedCountry = extractCountry(text) || country;
  const employment = extractEmployment(text);
  const docs = extractDocuments(text);
  const custom = extractCustom(text);

  return {
    identity: {
      givenName: name.given,
      familyName: name.family,
      fullName: name.full,
      preferredName: name.given,
    },
    contact: {
      email,
      phone,
      addresses: address ? [address] : [],
      country: extractedCountry,
    },
    documents: {
      passport: docs.passport ?? '',
      nationalId: docs.nationalId ?? '',
      emiratesId: docs.emiratesId ?? '',
    },
    employment: {
      employer: employment.employer,
      jobTitle: employment.jobTitle,
      department: employment.department,
    },
    custom,
  };
}

export function profileToFlat(profile: Profile): Record<string, string> {
  const flat: Record<string, string> = {};

  flat['identity.givenName'] = profile.identity.givenName;
  flat['identity.familyName'] = profile.identity.familyName;
  flat['identity.fullName'] = profile.identity.fullName;
  flat['identity.preferredName'] = profile.identity.preferredName;

  flat['contact.email'] = profile.contact.email;
  flat['contact.phone'] = profile.contact.phone;
  flat['contact.country'] = profile.contact.country;

  profile.contact.addresses.forEach((addr, i) => {
    flat[`contact.addresses.${i}`] = addr;
  });

  for (const [key, val] of Object.entries(profile.documents)) {
    flat[`documents.${key}`] = val;
  }

  for (const [key, val] of Object.entries(profile.employment)) {
    flat[`employment.${key}`] = val;
  }

  for (const [key, val] of Object.entries(profile.custom)) {
    flat[`custom.${key}`] = val;
  }

  return flat;
}

export function getExtractedSummary(profile: Profile): string[] {
  const found: string[] = [];
  if (profile.identity.fullName) found.push(`Name: ${profile.identity.fullName}`);
  if (profile.contact.email) found.push(`Email: ${profile.contact.email}`);
  if (profile.contact.phone) found.push(`Phone: ${profile.contact.phone}`);
  if (profile.contact.addresses.length > 0) found.push(`Address: ${profile.contact.addresses[0]}`);
  if (profile.contact.country) found.push(`Country: ${profile.contact.country}`);
  if (profile.employment.employer) found.push(`Employer: ${profile.employment.employer}`);
  if (profile.employment.jobTitle) found.push(`Job title: ${profile.employment.jobTitle}`);
  if (profile.employment.department) found.push(`Department: ${profile.employment.department}`);
  if (profile.documents.passport) found.push(`Passport: ${profile.documents.passport}`);
  if (profile.documents.nationalId) found.push(`National ID: ${profile.documents.nationalId}`);
  for (const [key, val] of Object.entries(profile.custom)) {
    if (val) found.push(`${key}: ${val}`);
  }
  return found;
}
