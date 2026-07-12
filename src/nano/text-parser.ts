import type { Profile } from '../types/profile';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\+?\d[\d\s()-]{6,}\d/g;
const ADDRESS_KEYWORDS = /\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|circle|cir|trail|trl)\b/i;
const POSTAL_CODE_RE = /\b\d{4,6}\b/;
const NAME_PREFIXES = /^(?:i am|my name is|name:|i'm)\s+/i;

function findAll(text: RegExp, input: string): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = text.exec(input)) !== null) {
    matches.push(m[0].trim());
  }
  return matches;
}

function extractEmail(text: string): string {
  const emails = findAll(EMAIL_RE, text);
  return emails[0] ?? '';
}

function extractPhone(text: string): string {
  const phones = findAll(PHONE_RE, text);
  const cleaned = phones
    .map((p) => p.replace(/[(]/g, '').replace(/[)]/g, '').trim())
    .filter((p) => p.replace(/\D/g, '').length >= 7);
  return cleaned[0] ?? '';
}

function extractAddress(text: string): { address: string; country: string } {
  const sentences = text.split(/[.!?\n]+/);
  for (const s of sentences) {
    if (ADDRESS_KEYWORDS.test(s)) {
      return { address: s.trim(), country: '' };
    }
  }
  const lines = text.split('\n');
  for (const line of lines) {
    if (ADDRESS_KEYWORDS.test(line) || POSTAL_CODE_RE.test(line)) {
      return { address: line.trim(), country: '' };
    }
  }
  return { address: '', country: '' };
}

function extractCountry(text: string): string {
  const countryMatch = text.match(/(?:country(?:\s*of\s*residence)?|nation|based\s+in|located\s+in|from)[:\s]*([A-Za-z\s]{2,30})/i);
  if (countryMatch) return (countryMatch[1] ?? '').replace(/[.,;!?]+$/, '').trim();
  return '';
}

function extractName(text: string): { given: string; family: string; full: string } {
  const nameMatch = text.match(NAME_PREFIXES);
  if (nameMatch) {
    const rest = text.slice(nameMatch[0].length).trim();
    const end = rest.search(/[.!?\n,;]/);
    const name = end > 0 ? rest.slice(0, end).trim() : rest.split(/\s+/).slice(0, 3).join(' ');
    return parseFullName(name);
  }

  const sentences = text.split(/[.!?\n]+/);
  const first = sentences[0]?.trim() ?? '';
  const words = first.split(/\s+/);
  if (words.length >= 2 && words.length <= 4) {
    const w0 = words[0] ?? '';
    const w1 = words[1] ?? '';
    const isName = /^[A-Z]/.test(w0) && /^[A-Z]/.test(w1);
    if (isName) {
      return parseFullName(words.slice(0, 3).join(' '));
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

  const empMatch = text.match(/(?:i work|works|working)\s+(?:at|for)\s+([A-Za-z0-9.&]+)/i);
  if (empMatch) employer = (empMatch[1] ?? '').replace(/[.,;!?]+$/, '').trim();

  const titleMatch = text.match(/(?:i(?:'m| am)\s+(?:a|an|the)?\s*)([A-Za-z\s]+?)(?:\s+(?:at|for|in)\s)|(?:job(?:title)?:|position:|role:)\s*([^,.\n]+)/i);
  if (titleMatch) jobTitle = ((titleMatch[1] ?? titleMatch[2]) ?? '').trim();

  const deptMatch = text.match(/(?:department:?\s*)([^,.\n]+)/i)
    ?? text.match(/in\s+(?:the\s+)?(\w+)\s+department/i);
  if (deptMatch) department = (deptMatch[1] ?? '').trim();

  const workLine = text.match(/(?:work(?:ing)?|works)\s+(?:at|for)\s+([A-Za-z0-9.&]+)\s+(?:as|in)\s+(?:a|an|the)?\s*([A-Za-z\s]+?)(?:\s+(?:at|for|in)|[,.]|$)/i);
  if (workLine) {
    if (!employer) employer = (workLine[1] ?? '').replace(/[.,;!?]+$/, '').trim();
    if (!jobTitle) jobTitle = (workLine[2] ?? '').trim();
  }

  return { employer, jobTitle, department };
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

  const dobMatch = text.match(/(?:dob|date of birth|born|birthday)[:\s]*(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})/i);
  if (dobMatch) custom.dateOfBirth = dobMatch[1] ?? '';

  return custom;
}

export function parseProfileText(text: string): Profile {
  const name = extractName(text);
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const { address } = extractAddress(text);
  const country = extractCountry(text);
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
      country,
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
