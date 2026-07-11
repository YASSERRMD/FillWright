import type { Profile, ProfilePath } from '../types/profile';
import { encrypt, decrypt, encryptedDataToBase64, base64ToEncryptedData } from './crypto';
import { saveToDB, loadFromDB, deleteFromDB } from './db';

const DEFAULT_PROFILE: Profile = {
  identity: {
    givenName: '',
    familyName: '',
    fullName: '',
    preferredName: '',
  },
  contact: {
    email: '',
    phone: '',
    addresses: [],
  },
  documents: {
    passport: '',
    nationalId: '',
    emiratesId: '',
  },
  employment: {
    employer: '',
    jobTitle: '',
    department: '',
  },
  custom: {},
};

let unlocked = false;
let currentProfile: Profile | null = null;
let idleTimeout: ReturnType<typeof setTimeout> | null = null;
let idleTimeoutMs = 5 * 60 * 1000;

export function setIdleTimeout(ms: number): void {
  idleTimeoutMs = ms;
}

function resetIdleTimer(): void {
  if (idleTimeout) {
    clearTimeout(idleTimeout);
  }
  idleTimeout = setTimeout(() => {
    lock();
  }, idleTimeoutMs);
}

function setPathValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]!] = value;
}

function getPathValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export async function unlock(_passphrase: string): Promise<boolean> {
  try {
    let encryptedData: string | null = null;
    try {
      encryptedData = await loadFromDB();
    } catch {
      // IndexedDB not available (e.g. jsdom), proceed without persistence
    }

    if (!encryptedData) {
      currentProfile = { ...DEFAULT_PROFILE };
      unlocked = true;
      resetIdleTimer();
      return true;
    }

    const encrypted = base64ToEncryptedData(encryptedData);
    const decrypted = await decrypt(encrypted, _passphrase);
    currentProfile = JSON.parse(decrypted) as Profile;
    unlocked = true;
    resetIdleTimer();
    return true;
  } catch {
    return false;
  }
}

export function lock(): void {
  unlocked = false;
  currentProfile = null;
  if (idleTimeout) {
    clearTimeout(idleTimeout);
    idleTimeout = null;
  }
}

export function getProfile(): Profile | null {
  if (!unlocked || !currentProfile) return null;
  resetIdleTimer();
  return structuredClone(currentProfile);
}

export function setField(path: ProfilePath, value: string): boolean {
  if (!unlocked || !currentProfile) return false;
  setPathValue(currentProfile as unknown as Record<string, unknown>, path, value);
  resetIdleTimer();
  return true;
}

export function getField(path: ProfilePath): string {
  if (!unlocked || !currentProfile) return '';
  const val = getPathValue(currentProfile as unknown as Record<string, unknown>, path);
  return typeof val === 'string' ? val : '';
}

export async function save(passphrase: string): Promise<boolean> {
  if (!unlocked || !currentProfile) return false;

  try {
    const json = JSON.stringify(currentProfile);
    const encrypted = await encrypt(json, passphrase);
    const base64 = encryptedDataToBase64(encrypted);
    await saveToDB(base64);
    return true;
  } catch {
    return false;
  }
}

export async function importProfile(json: string): Promise<boolean> {
  if (!unlocked) return false;

  try {
    const profile = JSON.parse(json) as Profile;
    currentProfile = profile;
    resetIdleTimer();
    return true;
  } catch {
    return false;
  }
}

export function exportProfile(): string | null {
  if (!unlocked || !currentProfile) return null;
  resetIdleTimer();
  return JSON.stringify(currentProfile);
}

export async function deleteProfile(): Promise<void> {
  lock();
  await deleteFromDB();
}

export function getFlattenedProfile(): Record<string, string> {
  if (!unlocked || !currentProfile) return {};

  const flat: Record<string, string> = {};

  flat['identity.givenName'] = currentProfile.identity.givenName;
  flat['identity.familyName'] = currentProfile.identity.familyName;
  flat['identity.fullName'] = currentProfile.identity.fullName;
  flat['identity.preferredName'] = currentProfile.identity.preferredName;
  flat['contact.email'] = currentProfile.contact.email;
  flat['contact.phone'] = currentProfile.contact.phone;

  currentProfile.contact.addresses.forEach((addr, i) => {
    flat[`contact.addresses.${i}`] = addr;
  });

  for (const [key, val] of Object.entries(currentProfile.documents)) {
    flat[`documents.${key}`] = val;
  }

  for (const [key, val] of Object.entries(currentProfile.employment)) {
    flat[`employment.${key}`] = val;
  }

  for (const [key, val] of Object.entries(currentProfile.custom)) {
    flat[`custom.${key}`] = val;
  }

  return flat;
}
