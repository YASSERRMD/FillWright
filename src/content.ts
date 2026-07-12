import { scanPage, observeChanges } from './scanner';
import { generateFillPlan } from './nano';
import { showConfirmation } from './ui';
import { execute } from './mcp/executor';

let enabled = true;

function getProfileFromStorage(): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['profiles', 'activeProfile'], (data) => {
      const profiles = (data.profiles ?? {}) as Record<string, Record<string, string>>;
      const active = (data.activeProfile as string) ?? '';
      resolve(profiles[active] ?? {});
    });
  });
}

function injectFillwrightUI(): void {
  if (document.getElementById('fillwright-ext-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'fillwright-ext-btn';
  btn.textContent = 'Fill Form';
  btn.style.cssText = `
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
    transition: opacity 0.2s;
  `;
  btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; });
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });
  btn.addEventListener('click', () => handleFill());
  document.body.appendChild(btn);
}

function removeFillwrightUI(): void {
  document.getElementById('fillwright-ext-btn')?.remove();
}

async function handleFill(): Promise<void> {
  if (!enabled) return;

  const profile = await getProfileFromStorage();
  if (Object.keys(profile).length === 0) {
    console.warn('[Fillwright] No profile data. Open the extension popup and create a profile.');
    return;
  }

  const schema = scanPage();
  console.log(`[Fillwright] Scanned ${schema.fields.length} fields`);

  const result = await generateFillPlan(schema, profile);

  if (!result.ok) {
    console.error('[Fillwright] Failed to generate plan:', result.error);
    return;
  }

  if (result.plan.length === 0) {
    console.log('[Fillwright] No fields to fill');
    return;
  }

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

  showConfirmation({
    mode: 'review-before-fill',
    items: diffItems,
    onConfirm: (accepted) => {
      for (const item of accepted) {
        const tool = result.plan.find((s) => s.field_id === item.field_id)?.tool ?? 'fill_field';
        execute(tool as 'fill_field' | 'select_option' | 'toggle', {
          field_id: item.field_id,
          value: item.newValue,
          state: item.newValue === 'true',
        });
      }
      console.log(`[Fillwright] Done. ${accepted.length} fields filled.`);
    },
    onCancel: () => {
      console.log('[Fillwright] Cancelled by user');
    },
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'FILL_FORM') {
    handleFill().then(() => {
      sendResponse({ filled: true, count: 0 });
    }).catch((err) => {
      sendResponse({ filled: false, error: String(err) });
    });
    return true; // async response
  }

  if (msg.type === 'TOGGLE_FILLWRIGHT') {
    enabled = msg.enabled;
    if (enabled) {
      injectFillwrightUI();
    } else {
      removeFillwrightUI();
    }
    sendResponse({ ok: true });
    return false;
  }
});

// Auto-inject on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => injectFillwrightUI());
} else {
  injectFillwrightUI();
}

// Watch for SPA navigation
observeChanges(() => {
  if (enabled && !document.getElementById('fillwright-ext-btn')) {
    injectFillwrightUI();
  }
});
