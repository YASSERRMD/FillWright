import { scanPage, observeChanges } from './scanner';
import { generateFillPlan } from './nano';
import {
  getFlattenedProfile,
  unlock,
  setField,
  save,
  listProfiles,
  getCurrentProfileName,
  switchProfile,
} from './store';
import { showConfirmation, showProfileCreate, ProfileSelector } from './ui';
import { execute } from './mcp/executor';
import { profileToFlat } from './nano/text-parser';
import type { Profile } from './types/profile';

const DEMO_PROFILE: Record<string, string> = {
  'identity.givenName': 'Alice',
  'identity.familyName': 'Johnson',
  'identity.fullName': 'Alice Johnson',
  'identity.preferredName': 'Alice',
  'contact.email': 'alice.johnson@example.com',
  'contact.phone': '+1-555-0123',
  'contact.addresses.0': '123 Main Street, Springfield, IL 62701',
  'documents.passport': 'AB1234567',
  'documents.nationalId': 'US-987654321',
  'employment.employer': 'Acme Corp',
  'employment.jobTitle': 'Software Engineer',
  'employment.department': 'Engineering',
};

let selector: ProfileSelector | null = null;

function applyProfile(flat: Record<string, string>): void {
  for (const [key, value] of Object.entries(flat)) {
    setField(key, value);
  }
}

async function initFillwright(): Promise<void> {
  console.log('[Fillwright] Initializing...');

  const unlocked = await unlock('demo');
  if (!unlocked) {
    console.error('[Fillwright] Failed to unlock profile store');
    return;
  }

  applyProfile(DEMO_PROFILE);
  await save('demo');

  const profile = getFlattenedProfile();
  console.log('[Fillwright] Profile loaded:', profile);

  const schema = scanPage();
  console.log(`[Fillwright] Scanned ${schema.fields.length} fields`);

  observeChanges((newSchema) => {
    console.log(`[Fillwright] Rescanned: ${newSchema.fields.length} fields`);
  });

  addFillButton();
  await initProfileSelector();

  console.log('[Fillwright] Ready.');
}

async function initProfileSelector(): Promise<void> {
  const names = await listProfiles();
  const active = getCurrentProfileName();

  selector = new ProfileSelector({
    profiles: names.length > 0 ? names : ['default'],
    activeProfile: active,
    onSelect: (name) => handleProfileSwitch(name),
    onCreateNew: () => openCreateProfile(),
  });
}

async function handleProfileSwitch(name: string): Promise<void> {
  console.log(`[Fillwright] Switching to profile: ${name}`);
  const ok = await switchProfile(name, 'demo');
  if (ok) {
    const flat = getFlattenedProfile();
    console.log(`[Fillwright] Loaded profile "${name}":`, flat);
    refreshSelector();
  }
}

async function refreshSelector(): Promise<void> {
  if (!selector) return;
  const names = await listProfiles();
  const active = getCurrentProfileName();
  selector.update(names.length > 0 ? names : ['default'], active);
}

function openCreateProfile(): void {
  listProfiles().then((names) => {
    showProfileCreate({
      existingNames: names,
      onSave: async (name: string, profile: Profile) => {
        const flat = profileToFlat(profile);
        applyProfile(flat);
        await save('demo');
        console.log(`[Fillwright] Profile "${name}" created:`, flat);
        await refreshSelector();
      },
      onCancel: () => {
        console.log('[Fillwright] Profile creation cancelled');
      },
    });
  });
}

function addFillButton(): void {
  const fillBtn = document.createElement('button');
  fillBtn.textContent = 'Fill Form';
  fillBtn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 24px;
    background: #1B2A4A;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 2147483646;
    font-family: Georgia, serif;
    letter-spacing: 0.5px;
  `;
  fillBtn.addEventListener('click', () => runFill());
  document.body.appendChild(fillBtn);
}

async function runFill(): Promise<void> {
  console.log('[Fillwright] Running fill...');

  const schema = scanPage();
  const profile = getFlattenedProfile();

  console.log('[Fillwright] Schema fields:', schema.fields.map(f => ({
    id: f.field_id,
    label: f.label,
    name: f.name,
    autocomplete: f.autocomplete,
    type: f.type,
  })));
  console.log('[Fillwright] Profile:', profile);

  const result = await generateFillPlan(schema, profile);

  if (!result.ok) {
    console.error('[Fillwright] Failed to generate plan:', result.error);
    return;
  }

  console.log(`[Fillwright] Got plan (${result.source}):`, result.plan);

  const diffItems = result.plan.map((step) => {
    const field = schema.fields.find((f) => f.field_id === step.field_id);
    return {
      field_id: step.field_id,
      label: field?.label ?? step.field_id,
      oldValue: field?.currentValue ?? '',
      newValue: step.value,
      confidence: step.confidence,
      accepted: true,
    };
  });

  if (diffItems.length === 0) {
    console.log('[Fillwright] No fields to fill');
    return;
  }

  showConfirmation({
    mode: 'review-before-fill',
    items: diffItems,
    onConfirm: (accepted) => {
      for (const item of accepted) {
        const tool = result.plan.find((s) => s.field_id === item.field_id)?.tool ?? 'fill_field';
        const toolResult = execute(tool as 'fill_field' | 'select_option' | 'toggle', {
          field_id: item.field_id,
          value: item.newValue,
          state: item.newValue === 'true',
        });
        console.log(`[Fillwright] Filled ${item.field_id}:`, toolResult);
      }
      console.log(`[Fillwright] Done. ${accepted.length} fields filled.`);
    },
    onCancel: () => {
      console.log('[Fillwright] Cancelled by user');
    },
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initFillwright());
} else {
  initFillwright();
}
