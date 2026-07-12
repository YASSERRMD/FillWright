import { parseProfileText, getExtractedSummary } from '../nano/text-parser';
import type { Profile } from '../types/profile';

let enabled = true;

const profileSelect = document.getElementById('profile-select') as HTMLSelectElement;
const btnNewProfile = document.getElementById('btn-new-profile') as HTMLButtonElement;
const btnCancelCreate = document.getElementById('btn-cancel-create') as HTMLButtonElement;
const createSection = document.getElementById('create-profile-section') as HTMLDivElement;
const profileNameInput = document.getElementById('profile-name-input') as HTMLInputElement;
const profileTextInput = document.getElementById('profile-text-input') as HTMLTextAreaElement;
const extractedPreview = document.getElementById('extracted-preview') as HTMLDivElement;
const extractedList = document.getElementById('extracted-list') as HTMLUListElement;
const btnSaveProfile = document.getElementById('btn-save-profile') as HTMLButtonElement;
const btnFill = document.getElementById('btn-fill') as HTMLButtonElement;
const btnToggle = document.getElementById('btn-toggle') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;

function setStatus(msg: string): void {
  statusEl.textContent = msg;
}

function showCreateProfile(): void {
  createSection.style.display = 'block';
  profileNameInput.value = suggestProfileName();
  profileTextInput.value = '';
  extractedPreview.style.display = 'none';
  profileNameInput.focus();
}

function hideCreateProfile(): void {
  createSection.style.display = 'none';
}

function suggestProfileName(): string {
  const opts = Array.from(profileSelect.options).map((o) => o.value);
  let n = 1;
  while (opts.includes(`Profile ${n}`)) n++;
  return `Profile ${n}`;
}

function onTextInput(): void {
  const text = profileTextInput.value.trim();
  if (text.length < 10) {
    extractedPreview.style.display = 'none';
    return;
  }

  const profile = parseProfileText(text);
  const summary = getExtractedSummary(profile);

  extractedList.innerHTML = '';
  if (summary.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No fields detected yet.';
    li.style.color = '#999';
    extractedList.appendChild(li);
  } else {
    for (const item of summary) {
      const li = document.createElement('li');
      const colonIdx = item.indexOf(':');
      if (colonIdx > 0) {
        const label = document.createElement('span');
        label.textContent = item.slice(0, colonIdx + 1) + ' ';
        const value = document.createElement('span');
        value.className = 'value';
        value.textContent = item.slice(colonIdx + 1);
        li.appendChild(label);
        li.appendChild(value);
      } else {
        li.textContent = item;
      }
      extractedList.appendChild(li);
    }
  }

  extractedPreview.style.display = 'block';
}

async function saveProfile(): Promise<void> {
  const name = profileNameInput.value.trim();
  const text = profileTextInput.value.trim();

  if (!name) {
    setStatus('Enter a profile name');
    return;
  }

  const existing = Array.from(profileSelect.options).map((o) => o.value);
  if (existing.includes(name)) {
    setStatus('Profile name already exists');
    return;
  }

  if (!text) {
    setStatus('Write something about yourself');
    return;
  }

  const profile = parseProfileText(text);
  const flat = profileToFlat(profile);

  // Save to chrome.storage.local
  const data = await chrome.storage.local.get('profiles');
  const profiles = (data.profiles ?? {}) as Record<string, Record<string, string>>;
  profiles[name] = flat;
  await chrome.storage.local.set({ profiles, activeProfile: name });

  refreshProfileList();
  hideCreateProfile();
  setStatus(`Profile "${name}" saved`);
}

function profileToFlat(profile: Profile): Record<string, string> {
  const flat: Record<string, string> = {};
  flat['identity.givenName'] = profile.identity.givenName;
  flat['identity.familyName'] = profile.identity.familyName;
  flat['identity.fullName'] = profile.identity.fullName;
  flat['identity.preferredName'] = profile.identity.preferredName;
  flat['contact.email'] = profile.contact.email;
  flat['contact.phone'] = profile.contact.phone;
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

async function refreshProfileList(): Promise<void> {
  const data = await chrome.storage.local.get(['profiles', 'activeProfile']);
  const profiles = (data.profiles ?? {}) as Record<string, Record<string, string>>;
  const active = (data.activeProfile as string) ?? '';

  profileSelect.innerHTML = '';
  const names = Object.keys(profiles);

  if (names.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No profiles yet';
    profileSelect.appendChild(opt);
    return;
  }

  for (const name of names) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === active) opt.selected = true;
    profileSelect.appendChild(opt);
  }
}

async function onProfileChange(): Promise<void> {
  const name = profileSelect.value;
  if (name) {
    await chrome.storage.local.set({ activeProfile: name });
    setStatus(`Switched to "${name}"`);
  }
}

async function fillForm(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus('No active tab');
    return;
  }

  setStatus('Filling...');

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'FILL_FORM' });
    if (response?.filled) {
      setStatus(`Filled ${response.count} fields`);
    } else {
      setStatus(response?.error ?? 'No fields to fill');
    }
  } catch {
    setStatus('Page not ready. Reload and try again.');
  }
}

async function toggleEnabled(): Promise<void> {
  enabled = !enabled;
  btnToggle.textContent = enabled ? 'On' : 'Off';
  btnToggle.classList.toggle('active', enabled);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_FILLWRIGHT', enabled });
    setStatus(enabled ? 'Fillwright enabled' : 'Fillwright disabled');
  }
}

// Wire up events
btnNewProfile.addEventListener('click', showCreateProfile);
btnCancelCreate.addEventListener('click', hideCreateProfile);
btnSaveProfile.addEventListener('click', saveProfile);
profileTextInput.addEventListener('input', onTextInput);
profileSelect.addEventListener('change', onProfileChange);
btnFill.addEventListener('click', fillForm);
btnToggle.addEventListener('click', toggleEnabled);

// Init
refreshProfileList();
