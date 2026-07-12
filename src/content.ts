import { scanPage, observeChanges } from './scanner';

let enabled = true;

function getProfileFromStorage(): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'GET_PROFILE' }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Fillwright] Extension context may be invalidated. Reload the page.');
          resolve({});
          return;
        }
        resolve(response?.profile ?? {});
      });
    } catch {
      console.warn('[Fillwright] Extension context invalidated. Reload the page.');
      resolve({});
    }
  });
}

function showNotification(message: string, type: 'info' | 'error' | 'success'): void {
  const existing = document.getElementById('fillwright-notification');
  if (existing) existing.remove();

  const colors = {
    info: { bg: '#1B2A4A', border: '#1B2A4A' },
    error: { bg: '#d93025', border: '#d93025' },
    success: { bg: '#1B2A4A', border: '#C5A55A' },
  };

  const div = document.createElement('div');
  div.id = 'fillwright-notification';
  div.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: ${colors[type].bg};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 2147483646;
    max-width: 320px;
    border-left: 4px solid ${colors[type].border};
    animation: fillwright-slide-in 0.3s ease;
  `;
  div.textContent = message;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes fillwright-slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(div);

  setTimeout(() => {
    div.style.transition = 'opacity 0.3s';
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, 4000);
}

function showNoProfileOverlay(): void {
  if (document.getElementById('fillwright-no-profile')) return;

  const host = document.createElement('div');
  host.id = 'fillwright-no-profile';
  host.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;display:flex;align-items:center;justify-content:center;';

  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);';

  const dialog = document.createElement('div');
  dialog.style.cssText = 'background:white;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:400px;width:90%;padding:24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;position:relative;z-index:1;';

  dialog.innerHTML = `
    <div style="width:56px;height:56px;background:#FFF3CD;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
      <span style="font-size:28px;color:#856404;font-weight:700;">!</span>
    </div>
    <h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:18px;color:#1B2A4A;">No Profile Found</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#666;line-height:1.5;">
      You need to create a profile before Fillwright can fill forms.
    </p>
    <p style="margin:0 0 20px;font-size:13px;color:#999;line-height:1.5;">
      Click the <strong style="color:#1B2A4A;">Fillwright icon</strong> in your Chrome toolbar, then click <strong style="color:#C5A55A;">+</strong> to create a profile.
    </p>
    <button id="fillwright-no-profile-close" style="padding:10px 24px;background:#1B2A4A;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:Georgia,serif;">
      Got it
    </button>
  `;

  host.appendChild(backdrop);
  host.appendChild(dialog);
  document.body.appendChild(host);

  const close = () => host.remove();
  dialog.querySelector('#fillwright-no-profile-close')?.addEventListener('click', close);
  backdrop.addEventListener('click', close);
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
    transition: all 0.2s;
  `;
  btn.addEventListener('mouseenter', () => { btn.style.background = '#0F1B33'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = '#1B2A4A'; });
  btn.addEventListener('click', () => handleFill(btn));
  document.body.appendChild(btn);
}

function removeFillwrightUI(): void {
  document.getElementById('fillwright-ext-btn')?.remove();
}

// --- Gemini Nano (runs in content script = page context) ---

function getSystemPrompt(): string {
  return `You are a form-filling assistant. You map profile data to form fields.

Rules:
1. Return ONLY a JSON array of fill steps. No prose, no markdown fences.
2. Each step: { "tool": "fill_field"|"select_option"|"toggle", "field_id": "...", "value": "...", "confidence": 0.0-1.0 }
3. For select_option, match by visible label or value.
4. For toggle, use "true" or "false" as value.
5. Split full name into given/family as needed.
6. Normalize dates to each field's pattern.
7. Normalize country names to match select options.
8. If confidence < 0.5, leave the field empty (omit from the plan).
9. Do not guess. Leave empty rather than guess.
10. Do not include fields not present in the schema.`;
}

function buildPrompt(schemaJson: string, profileJson: string): string {
  return `Given this form schema:
${schemaJson}

And this user profile:
${profileJson}

Map profile data to form fields. Return a JSON array of fill steps.`;
}

function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

function validateStep(step: unknown): boolean {
  const VALID_TOOLS = new Set(['fill_field', 'select_option', 'toggle']);
  const obj = step as Record<string, unknown>;
  if (typeof obj !== 'object' || obj === null) return false;
  if (typeof obj.tool !== 'string' || !VALID_TOOLS.has(obj.tool)) return false;
  if (typeof obj.field_id !== 'string' || obj.field_id.length === 0) return false;
  if (typeof obj.value !== 'string') return false;
  if (typeof obj.confidence !== 'number') return false;
  return true;
}

interface NanoPlanResult {
  ok: boolean;
  plan: Array<{ tool: string; field_id: string; value: string; confidence: number }>;
  source: 'nano' | 'fallback';
  error?: string;
}

async function generateFillPlanWithNano(
  schema: ReturnType<typeof scanPage>,
  profile: Record<string, string>
): Promise<NanoPlanResult> {
  // Check if LanguageModel API is available
  const LM = (window as unknown as Record<string, unknown>)['LanguageModel'] as {
    availability: () => Promise<string>;
    createSession: (opts: { systemPrompt: string }) => Promise<{
      prompt: (input: string) => Promise<string>;
      destroy: () => void;
    }>;
  } | undefined;

  if (!LM) {
    console.log('[Fillwright] LanguageModel API not available, using fallback');
    return generateFallbackPlan(schema, profile);
  }

  try {
    const status = await LM.availability();
    console.log(`[Fillwright] LanguageModel status: ${status}`);

    if (status !== 'available') {
      console.log('[Fillwright] Model not available, using fallback');
      return generateFallbackPlan(schema, profile);
    }

    const session = await LM.createSession({ systemPrompt: getSystemPrompt() });
    const prompt = buildPrompt(JSON.stringify({ fields: schema.fields }), JSON.stringify(profile));

    console.log('[Fillwright] Sending prompt to Gemini Nano...');
    const raw = await session.prompt(prompt);
    session.destroy();

    console.log('[Fillwright] Raw model response:', raw);

    const cleaned = stripMarkdownFences(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn('[Fillwright] Failed to parse model response as JSON');
      return generateFallbackPlan(schema, profile);
    }

    if (!Array.isArray(parsed)) {
      console.warn('[Fillwright] Model response is not an array');
      return generateFallbackPlan(schema, profile);
    }

    const validSteps = (parsed as unknown[]).filter(validateStep);
    if (validSteps.length === 0) {
      console.warn('[Fillwright] No valid steps in model response');
      return generateFallbackPlan(schema, profile);
    }

    console.log(`[Fillwright] Gemini Nano produced ${validSteps.length} fill steps`);
    return { ok: true, plan: validSteps as Array<{ tool: string; field_id: string; value: string; confidence: number }>, source: 'nano' };
  } catch (err) {
    console.error('[Fillwright] Nano error:', err);
    return generateFallbackPlan(schema, profile);
  }
}

// --- Fallback (regex-based) ---

function generateFallbackPlan(
  schema: ReturnType<typeof scanPage>,
  profile: Record<string, string>
): NanoPlanResult {
  const plan: Array<{ tool: string; field_id: string; value: string; confidence: number }> = [];

  const LABEL_MAP: Array<{ patterns: RegExp[]; profileKey: string; tool: string }> = [
    { patterns: [/first\s*name/i], profileKey: 'identity.givenName', tool: 'fill_field' },
    { patterns: [/last\s*name/i, /family\s*name/i, /surname/i], profileKey: 'identity.familyName', tool: 'fill_field' },
    { patterns: [/full\s*name/i, /^name$/i], profileKey: 'identity.fullName', tool: 'fill_field' },
    { patterns: [/e-?mail/i], profileKey: 'contact.email', tool: 'fill_field' },
    { patterns: [/phone/i, /mobile/i, /cell/i, /telephone/i, /phone\s*number/i], profileKey: 'contact.phone', tool: 'fill_field' },
    { patterns: [/address/i, /street/i], profileKey: 'contact.addresses.0', tool: 'fill_field' },
    { patterns: [/country/i], profileKey: 'contact.country', tool: 'select_option' },
    { patterns: [/passport/i], profileKey: 'documents.passport', tool: 'fill_field' },
    { patterns: [/national\s*id/i, /id\s*number/i], profileKey: 'documents.nationalId', tool: 'fill_field' },
    { patterns: [/employer/i, /company/i, /organization/i], profileKey: 'employment.employer', tool: 'fill_field' },
    { patterns: [/job\s*title/i, /position/i, /role/i], profileKey: 'employment.jobTitle', tool: 'fill_field' },
  ];

  for (const field of schema.fields) {
    if (field.hidden || field.type === 'hidden') continue;

    const label = String(field.label ?? field.nearbyText ?? '').trim();
    if (!label) continue;

    let profileKey: string | null = null;
    let tool = 'fill_field';

    for (const mapping of LABEL_MAP) {
      for (const pattern of mapping.patterns) {
        if (pattern.test(label)) {
          profileKey = mapping.profileKey;
          tool = mapping.tool;
          break;
        }
      }
      if (profileKey) break;
    }

    if (!profileKey) continue;

    const value = profile[profileKey] ?? '';
    if (!value) continue;

    plan.push({ tool, field_id: field.field_id, value, confidence: 0.7 });
  }

  return { ok: true, plan, source: 'fallback' };
}

// --- Fill execution ---

function applyFillPlan(plan: Array<{ tool: string; field_id: string; value: string }>): number {
  let filled = 0;

  for (const step of plan) {
    const schema = scanPage();
    const field = schema.fields.find((f) => f.field_id === step.field_id);
    if (!field) continue;

    const el = document.querySelector(field.selector);
    if (!el) continue;

    if (step.tool === 'fill_field') {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const nativeSetter = el instanceof HTMLInputElement
          ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
          : Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(el, step.value);
        } else {
          el.value = step.value;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      } else if (el.getAttribute('role') === 'textbox' || el.getAttribute('contenteditable') === 'true') {
        el.textContent = step.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      }
    } else if (step.tool === 'select_option') {
      if (el instanceof HTMLSelectElement) {
        el.value = step.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      } else if (el.getAttribute('role') === 'listbox') {
        const options = el.querySelectorAll('[role="option"]');
        for (const opt of Array.from(options)) {
          const dataValue = opt.getAttribute('data-value') ?? opt.textContent?.trim() ?? '';
          if (dataValue.toLowerCase() === step.value.toLowerCase()) {
            opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            filled++;
            break;
          }
        }
      } else if (el.getAttribute('role') === 'radiogroup') {
        const options = el.querySelectorAll('[role="radio"]');
        for (const opt of Array.from(options)) {
          const dataValue = opt.getAttribute('data-value') ?? opt.textContent?.trim() ?? '';
          if (dataValue.toLowerCase() === step.value.toLowerCase()) {
            opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            filled++;
            break;
          }
        }
      }
    } else if (step.tool === 'toggle') {
      if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        el.checked = step.value === 'true';
        el.dispatchEvent(new Event('click', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      }
    }
  }

  return filled;
}

// --- Main handler ---

async function handleFill(btn?: HTMLButtonElement): Promise<void> {
  if (!enabled) return;

  if (btn) {
    btn.textContent = 'Scanning...';
    btn.style.background = '#C5A55A';
    btn.style.color = '#1B2A4A';
    btn.disabled = true;
  }

  try {
    const profile = await getProfileFromStorage();

    if (Object.keys(profile).length === 0) {
      showNoProfileOverlay();
      return;
    }

    const schema = scanPage();
    console.log(`[Fillwright] Scanned ${schema.fields.length} fields:`, schema.fields);

    if (schema.fields.length === 0) {
      showNotification('No form fields found on this page.', 'error');
      return;
    }

    if (btn) {
      btn.textContent = 'Planning...';
    }

    const result = await generateFillPlanWithNano(schema, profile);

    console.log(`[Fillwright] Fill plan (${result.source}):`, result.plan);

    if (result.plan.length === 0) {
      const fieldLabels = schema.fields.map((f) => f.label ?? f.nearbyText ?? f.name ?? f.type).join(', ');
      showNotification(
        `Found ${schema.fields.length} fields but couldn't match. Detected: ${fieldLabels}`,
        'error'
      );
      return;
    }

    if (btn) {
      btn.textContent = `Filling ${result.plan.length} fields...`;
    }

    const filled = applyFillPlan(result.plan);
    showNotification(`Filled ${filled}/${result.plan.length} fields (${result.source})`, 'success');
  } catch (err) {
    console.error('[Fillwright] Error:', err);
    if (String(err).includes('Extension context invalidated')) {
      showNotification('Extension was updated. Reload this page.', 'error');
    } else {
      showNotification(`Error: ${String(err)}`, 'error');
    }
  } finally {
    if (btn) {
      btn.textContent = 'Fill Form';
      btn.style.background = '#1B2A4A';
      btn.style.color = 'white';
      btn.disabled = false;
    }
  }
}

// --- Message listener ---

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'FILL_FORM') {
    handleFill().then(() => {
      sendResponse({ filled: true, count: 0 });
    }).catch((err) => {
      sendResponse({ filled: false, error: String(err) });
    });
    return true;
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

  if (msg.type === 'PING') {
    sendResponse({ pong: true });
    return false;
  }

  return false;
});

// --- Init ---

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => injectFillwrightUI());
} else {
  injectFillwrightUI();
}

observeChanges(() => {
  if (enabled && !document.getElementById('fillwright-ext-btn')) {
    injectFillwrightUI();
  }
});
