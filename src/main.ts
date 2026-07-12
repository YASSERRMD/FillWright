import { scanPage, observeChanges } from './scanner';
import { generateFillPlan } from './nano';
import { getFlattenedProfile, unlock, setField } from './store';
import { showConfirmation, showProfileImport } from './ui';
import { execute } from './mcp/executor';

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

function loadProfile(): void {
  for (const [key, value] of Object.entries(DEMO_PROFILE)) {
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

  loadProfile();

  const profile = getFlattenedProfile();
  console.log('[Fillwright] Profile loaded:', profile);

  const schema = scanPage();
  console.log(`[Fillwright] Scanned ${schema.fields.length} fields`);

  for (const field of schema.fields) {
    console.log(`  - ${field.field_id}: ${field.label ?? field.name ?? 'unknown'} (${field.type})`);
  }

  observeChanges((newSchema) => {
    console.log(`[Fillwright] Rescanned: ${newSchema.fields.length} fields`);
  });

  addFillButton();
  addImportButton();

  console.log('[Fillwright] Ready. Use the buttons in the bottom-right corner.');
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

function addImportButton(): void {
  const importBtn = document.createElement('button');
  importBtn.textContent = 'Import Profile';
  importBtn.style.cssText = `
    position: fixed;
    bottom: 72px;
    right: 20px;
    padding: 10px 20px;
    background: #C5A55A;
    color: #1B2A4A;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 2147483646;
    font-family: Georgia, serif;
    letter-spacing: 0.5px;
  `;
  importBtn.addEventListener('click', () => openProfileImport());
  document.body.appendChild(importBtn);
}

function openProfileImport(): void {
  const currentProfile = getFlattenedProfile();

  showProfileImport({
    currentProfile,
    onImport: (flat) => {
      for (const [key, value] of Object.entries(flat)) {
        setField(key, value);
      }
      console.log('[Fillwright] Profile imported:', getFlattenedProfile());
    },
    onCancel: () => {
      console.log('[Fillwright] Profile import cancelled');
    },
  });
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
