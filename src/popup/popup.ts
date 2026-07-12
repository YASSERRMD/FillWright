import { parseProfileText, getExtractedSummary } from '../nano/text-parser';
import type { Profile } from '../types/profile';

let enabled = true;
let editingProfile: string | null = null;

const profileSelect = document.getElementById('profile-select') as HTMLSelectElement;
const btnNewProfile = document.getElementById('btn-new-profile') as HTMLButtonElement;
const btnEditProfile = document.getElementById('btn-edit-profile') as HTMLButtonElement;
const btnDeleteProfile = document.getElementById('btn-delete-profile') as HTMLButtonElement;
const noProfileWarning = document.getElementById('no-profile-warning') as HTMLDivElement;
const profileDetail = document.getElementById('profile-detail') as HTMLDivElement;
const detailName = document.getElementById('detail-name') as HTMLSpanElement;
const detailCount = document.getElementById('detail-count') as HTMLSpanElement;
const detailGrid = document.getElementById('detail-grid') as HTMLDivElement;
const btnEditThis = document.getElementById('btn-edit-this') as HTMLButtonElement;
const profileForm = document.getElementById('profile-form') as HTMLDivElement;
const formTitle = document.getElementById('form-title') as HTMLSpanElement;
const btnCancelForm = document.getElementById('btn-cancel-form') as HTMLButtonElement;
const formProfileName = document.getElementById('form-profile-name') as HTMLInputElement;
const formTextInput = document.getElementById('form-text-input') as HTMLTextAreaElement;
const extractedPreview = document.getElementById('extracted-preview') as HTMLDivElement;
const extractedList = document.getElementById('extracted-list') as HTMLUListElement;
const btnSaveProfile = document.getElementById('btn-save-profile') as HTMLButtonElement;
const btnFill = document.getElementById('btn-fill') as HTMLButtonElement;
const btnToggle = document.getElementById('btn-toggle') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;
const customFieldsContainer = document.getElementById('custom-fields') as HTMLDivElement;
const btnAddCustom = document.getElementById('btn-add-custom') as HTMLButtonElement;

// Tab elements
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

const DETAIL_FIELDS: { key: string; label: string; group?: string }[] = [
  { key: 'identity.givenName', label: 'First Name', group: 'Identity' },
  { key: 'identity.familyName', label: 'Last Name', group: 'Identity' },
  { key: 'identity.fullName', label: 'Full Name', group: 'Identity' },
  { key: 'identity.preferredName', label: 'Preferred Name', group: 'Identity' },
  { key: 'contact.email', label: 'Email', group: 'Contact' },
  { key: 'contact.phone', label: 'Phone', group: 'Contact' },
  { key: 'contact.addresses.0', label: 'Address', group: 'Contact' },
  { key: 'documents.passport', label: 'Passport', group: 'Documents' },
  { key: 'documents.nationalId', label: 'National ID', group: 'Documents' },
  { key: 'documents.emiratesId', label: 'Emirates ID', group: 'Documents' },
  { key: 'employment.employer', label: 'Employer', group: 'Employment' },
  { key: 'employment.jobTitle', label: 'Job Title', group: 'Employment' },
  { key: 'employment.department', label: 'Department', group: 'Employment' },
];

function setStatus(msg: string): void {
  statusEl.textContent = msg;
  setTimeout(() => { statusEl.textContent = 'Ready'; }, 3000);
}

// --- Tabs ---
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.getAttribute('data-tab');
    tabContents.forEach((tc) => {
      tc.classList.toggle('active', tc.id === `tab-${target}`);
    });
  });
});

// --- Profile list ---
async function getProfiles(): Promise<Record<string, Record<string, string>>> {
  const data = await chrome.storage.local.get('profiles');
  return (data.profiles ?? {}) as Record<string, Record<string, string>>;
}

async function getActiveProfile(): Promise<string> {
  const data = await chrome.storage.local.get('activeProfile');
  return (data.activeProfile as string) ?? '';
}

async function refreshProfileList(): Promise<void> {
  const profiles = await getProfiles();
  const active = await getActiveProfile();
  const names = Object.keys(profiles);

  profileSelect.innerHTML = '';

  if (names.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '-- No profiles yet --';
    profileSelect.appendChild(opt);
    noProfileWarning.style.display = 'flex';
    profileDetail.style.display = 'none';
    btnEditProfile.disabled = true;
    btnDeleteProfile.disabled = true;
    return;
  }

  noProfileWarning.style.display = 'none';

  for (const name of names) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === active) opt.selected = true;
    profileSelect.appendChild(opt);
  }

  btnEditProfile.disabled = false;
  btnDeleteProfile.disabled = false;

  showProfileDetail(active || (names[0] ?? ''));
}

function showProfileDetail(name: string): void {
  const profiles = profileSelect.value ? getProfilesFromSelect() : {};
  const flat = profiles[name];
  if (!flat) {
    profileDetail.style.display = 'none';
    return;
  }

  detailName.textContent = name;
  const fieldCount = Object.values(flat).filter((v) => v).length;
  detailCount.textContent = `${fieldCount} fields`;

  detailGrid.innerHTML = '';

  for (const def of DETAIL_FIELDS) {
    const val = flat[def.key] ?? '';
    const item = document.createElement('div');
    item.className = `detail-item${def.key.includes('address') ? ' full-width' : ''}`;

    const label = document.createElement('div');
    label.className = 'detail-item-label';
    label.textContent = def.label;

    const value = document.createElement('div');
    value.className = `detail-item-value${val ? '' : ' empty'}`;
    value.textContent = val || 'Not set';

    item.appendChild(label);
    item.appendChild(value);
    detailGrid.appendChild(item);
  }

  // Show custom fields
  for (const [key, val] of Object.entries(flat)) {
    if (key.startsWith('custom.')) {
      const item = document.createElement('div');
      item.className = 'detail-item';

      const label = document.createElement('div');
      label.className = 'detail-item-label';
      label.textContent = key.replace('custom.', '');

      const value = document.createElement('div');
      value.className = `detail-item-value${val ? '' : ' empty'}`;
      value.textContent = val || 'Not set';

      item.appendChild(label);
      item.appendChild(value);
      detailGrid.appendChild(item);
    }
  }

  profileDetail.style.display = 'block';
}

function getProfilesFromSelect(): Record<string, Record<string, string>> {
  // Synchronous cache - populated on last refresh
  return (window as unknown as { __profilesCache: Record<string, Record<string, string>> }).__profilesCache ?? {};
}

// Store profiles for sync access
let profilesCache: Record<string, Record<string, string>> = {};
(async () => { profilesCache = await getProfiles(); })();

// --- Create / Edit form ---
function showForm(mode: 'create' | 'edit', name?: string): void {
  profileForm.style.display = 'block';
  profileDetail.style.display = 'none';

  if (mode === 'edit' && name) {
    editingProfile = name;
    formTitle.textContent = `Edit: ${name}`;
    formProfileName.value = name;
    formProfileName.disabled = true;

    // Load profile data into manual fields
    profilesCache = {};
    chrome.storage.local.get('profiles', (data) => {
      profilesCache = (data.profiles ?? {}) as Record<string, Record<string, string>>;
      const flat = profilesCache[name] ?? {};
      fillManualFields(flat);
    });

    // Switch to manual tab
    tabs.forEach((t) => t.classList.remove('active'));
    tabContents.forEach((tc) => tc.classList.remove('active'));
    document.querySelector('[data-tab="manual"]')?.classList.add('active');
    document.getElementById('tab-manual')?.classList.add('active');
  } else {
    editingProfile = null;
    formTitle.textContent = 'Create Profile';
    formProfileName.value = suggestProfileName();
    formProfileName.disabled = false;
    clearManualFields();
    formTextInput.value = '';
    extractedPreview.style.display = 'none';

    // Switch to quick tab
    tabs.forEach((t) => t.classList.remove('active'));
    tabContents.forEach((tc) => tc.classList.remove('active'));
    document.querySelector('[data-tab="quick"]')?.classList.add('active');
    document.getElementById('tab-quick')?.classList.add('active');
  }

  formProfileName.focus();
}

function hideForm(): void {
  profileForm.style.display = 'none';
  editingProfile = null;
  refreshProfileList();
}

function suggestProfileName(): string {
  const opts = Array.from(profileSelect.options).map((o) => o.value);
  let n = 1;
  while (opts.includes(`Profile ${n}`)) n++;
  return `Profile ${n}`;
}

function fillManualFields(flat: Record<string, string>): void {
  const inputs = document.querySelectorAll('.field-input') as NodeListOf<HTMLInputElement>;
  inputs.forEach((input) => {
    const field = input.getAttribute('data-field');
    if (field) input.value = flat[field] ?? '';
  });

  // Load custom fields
  customFieldsContainer.innerHTML = '';
  for (const [key, val] of Object.entries(flat)) {
    if (key.startsWith('custom.')) {
      addCustomFieldRow(key.replace('custom.', ''), val);
    }
  }
}

function clearManualFields(): void {
  const inputs = document.querySelectorAll('.field-input') as NodeListOf<HTMLInputElement>;
  inputs.forEach((input) => { input.value = ''; });
  customFieldsContainer.innerHTML = '';
}

function addCustomFieldRow(key = '', value = ''): void {
  const row = document.createElement('div');
  row.className = 'custom-row';

  const keyInput = document.createElement('input');
  keyInput.className = 'input';
  keyInput.placeholder = 'Key';
  keyInput.value = key;

  const valInput = document.createElement('input');
  valInput.className = 'input';
  valInput.placeholder = 'Value';
  valInput.value = value;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-icon btn-icon-danger';
  removeBtn.innerHTML = '&times;';
  removeBtn.style.cssText = 'width:28px;height:28px;font-size:14px;flex-shrink:0;';
  removeBtn.addEventListener('click', () => row.remove());

  row.appendChild(keyInput);
  row.appendChild(valInput);
  row.appendChild(removeBtn);
  customFieldsContainer.appendChild(row);
}

// --- Quick mode text input ---
function onTextInput(): void {
  const text = formTextInput.value.trim();
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

// --- Save ---
async function saveProfile(): Promise<void> {
  const name = formProfileName.value.trim();
  if (!name) {
    setStatus('Enter a profile name');
    return;
  }

  const existing = Object.keys(profilesCache);
  if (!editingProfile && existing.includes(name)) {
    setStatus('Profile name already exists');
    return;
  }

  let flat: Record<string, string> = {};

  // Check which tab is active
  const quickTab = document.getElementById('tab-quick');
  if (quickTab?.classList.contains('active')) {
    // Quick mode: parse paragraph
    const text = formTextInput.value.trim();
    if (!text) {
      setStatus('Write something about yourself');
      return;
    }
    const profile = parseProfileText(text);
    flat = profileToFlat(profile);
  } else {
    // Manual mode: collect from fields
    flat = collectManualFields();
    if (Object.values(flat).every((v) => !v)) {
      setStatus('Fill in at least one field');
      return;
    }
  }

  // Save
  const data = await chrome.storage.local.get('profiles');
  const profiles = (data.profiles ?? {}) as Record<string, Record<string, string>>;

  // If editing and name changed (not possible now since name is disabled)
  // If creating new or overwriting
  profiles[name] = flat;

  await chrome.storage.local.set({ profiles, activeProfile: name });
  profilesCache = profiles;

  hideForm();
  setStatus(editingProfile ? `Profile "${name}" updated` : `Profile "${name}" saved`);
}

function collectManualFields(): Record<string, string> {
  const flat: Record<string, string> = {};
  const inputs = document.querySelectorAll('.field-input') as NodeListOf<HTMLInputElement>;
  inputs.forEach((input) => {
    const field = input.getAttribute('data-field');
    const val = input.value.trim();
    if (field && val) flat[field] = val;
  });

  // Custom fields
  const rows = customFieldsContainer.querySelectorAll('.custom-row');
  rows.forEach((row) => {
    const inputs = row.querySelectorAll('input');
    const key = (inputs[0] as HTMLInputElement).value.trim();
    const val = (inputs[1] as HTMLInputElement).value.trim();
    if (key && val) flat[`custom.${key}`] = val;
  });

  return flat;
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
    if (val) flat[`documents.${key}`] = val;
  }
  for (const [key, val] of Object.entries(profile.employment)) {
    if (val) flat[`employment.${key}`] = val;
  }
  for (const [key, val] of Object.entries(profile.custom)) {
    if (val) flat[`custom.${key}`] = val;
  }
  return flat;
}

// --- Delete ---
async function deleteProfile(): Promise<void> {
  const name = profileSelect.value;
  if (!name) return;

  if (!confirm(`Delete profile "${name}"?`)) return;

  const data = await chrome.storage.local.get(['profiles', 'activeProfile']);
  const profiles = (data.profiles ?? {}) as Record<string, Record<string, string>>;
  delete profiles[name];

  const newActive = Object.keys(profiles)[0] ?? '';
  await chrome.storage.local.set({ profiles, activeProfile: newActive });
  profilesCache = profiles;

  setStatus(`Profile "${name}" deleted`);
  refreshProfileList();
}

// --- Profile switch ---
async function onProfileChange(): Promise<void> {
  const name = profileSelect.value;
  if (name) {
    await chrome.storage.local.set({ activeProfile: name });
    showProfileDetail(name);
    setStatus(`Switched to "${name}"`);
  }
}

// --- Fill Form ---
async function fillForm(): Promise<void> {
  const active = await getActiveProfile();
  const profiles = await getProfiles();

  if (!active || !profiles[active] || Object.keys(profiles[active]).length === 0) {
    setStatus('No profile! Create one first.');
    noProfileWarning.style.display = 'flex';
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus('No active tab');
    return;
  }

  setStatus('Filling...');

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'FILL_FORM' });
    if (response?.filled) {
      setStatus('Fill plan sent. Review in the page.');
    } else {
      setStatus(response?.error ?? 'Nothing to fill on this page');
    }
  } catch {
    setStatus('Reload the page and try again.');
  }
}

// --- Toggle ---
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

// --- Wire up ---
btnNewProfile.addEventListener('click', () => showForm('create'));
btnEditProfile.addEventListener('click', () => {
  const name = profileSelect.value;
  if (name) showForm('edit', name);
});
btnEditThis.addEventListener('click', () => {
  const name = profileSelect.value;
  if (name) showForm('edit', name);
});
btnDeleteProfile.addEventListener('click', deleteProfile);
btnCancelForm.addEventListener('click', hideForm);
btnSaveProfile.addEventListener('click', saveProfile);
formTextInput.addEventListener('input', onTextInput);
profileSelect.addEventListener('change', onProfileChange);
btnFill.addEventListener('click', fillForm);
btnToggle.addEventListener('click', toggleEnabled);
btnAddCustom.addEventListener('click', () => addCustomFieldRow());

// Init
refreshProfileList();
