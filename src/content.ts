import { scanPage, observeChanges } from './scanner';

let enabled = true;
let messageCounter = 0;

function getProfileFromStorage(): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'GET_PROFILE' }, (response) => {
        if (chrome.runtime.lastError) { resolve({}); return; }
        resolve(response?.profile ?? {});
      });
    } catch { resolve({}); }
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
  div.style.cssText = `position:fixed;bottom:80px;right:20px;background:${colors[type].bg};color:white;padding:12px 20px;border-radius:8px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:2147483646;max-width:350px;border-left:4px solid ${colors[type].border};animation:fw-slide-in 0.3s ease;`;
  div.textContent = message;
  if (!document.getElementById('fw-anim-style')) {
    const s = document.createElement('style');
    s.id = 'fw-anim-style';
    s.textContent = '@keyframes fw-slide-in{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
    document.head.appendChild(s);
  }
  document.body.appendChild(div);
  setTimeout(() => { div.style.transition = 'opacity 0.3s'; div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 5000);
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
  dialog.innerHTML = '<div style="width:56px;height:56px;background:#FFF3CD;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;"><span style="font-size:28px;color:#856404;font-weight:700;">!</span></div><h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:18px;color:#1B2A4A;">No Profile Found</h2><p style="margin:0 0 16px;font-size:14px;color:#666;line-height:1.5;">Create a profile first.</p><button id="fillwright-no-profile-close" style="padding:10px 24px;background:#1B2A4A;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:Georgia,serif;">Got it</button>';
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
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 24px;background:#1B2A4A;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:2147483646;font-family:Georgia,serif;letter-spacing:0.5px;transition:all 0.2s;';
  btn.addEventListener('mouseenter', () => { btn.style.background = '#0F1B33'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = '#1B2A4A'; });
  btn.addEventListener('click', () => handleFill(btn));
  document.body.appendChild(btn);
}

function removeFillwrightUI(): void {
  document.getElementById('fillwright-ext-btn')?.remove();
}

// --- Nano bridge via MAIN world postMessage ---

function sendToMainWorld(data: Record<string, unknown>, timeoutMs = 60000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = ++messageCounter;
    const timeout = setTimeout(() => reject(new Error('MAIN world response timeout')), timeoutMs);

    function handler(event: MessageEvent) {
      if (event.source !== window) return;
      if (!event.data || event.data.type !== 'FILLWRIGHT_NANO_RESPONSE' || event.data.id !== id) return;
      window.removeEventListener('message', handler);
      clearTimeout(timeout);
      resolve(event.data.result);
    }

    window.addEventListener('message', handler);
    window.postMessage({ type: 'FILLWRIGHT_NANO_REQUEST', id, ...data }, '*');
  });
}

function sendToExtension<T>(msg: Record<string, unknown>): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve((response as T) ?? null);
      });
    } catch { resolve(null); }
  });
}

// The Prompt API is exposed to extension pages (offscreen document), not to
// regular web pages, so the extension path is checked first. The page MAIN
// world path only works on pages with an origin trial or Chrome flag enabled.
let nanoVia: 'extension' | 'page' = 'extension';

async function callNanoCheck(): Promise<string> {
  const ext = await sendToExtension<{ status: string }>({ type: 'CHECK_NANO' });
  console.log('[Fillwright] Nano status via extension:', ext?.status);
  if (ext?.status === 'available') {
    nanoVia = 'extension';
    return 'available';
  }

  try {
    const page = await sendToMainWorld({ action: 'CHECK_NANO' }, 3000) as { status: string };
    console.log('[Fillwright] Nano status via page:', page?.status);
    if (page?.status === 'available') {
      nanoVia = 'page';
      return 'available';
    }
    return ext?.status ?? page?.status ?? 'unavailable';
  } catch {
    return ext?.status ?? 'unavailable';
  }
}

async function callNanoRun(
  schema: ReturnType<typeof scanPage>,
  profile: Record<string, string>
): Promise<{ ok: boolean; plan: Array<{ tool: string; field_id: string; value: string; confidence: number }>; source: string; error?: string }> {
  type NanoResult = { ok: boolean; plan: Array<{ tool: string; field_id: string; value: string; confidence: number }>; source: string; error?: string };

  // Slim the schema so Gemini Nano's small context isn't swamped on larger
  // forms — only send what's needed to map profile data to fields.
  const nanoFields = schema.fields
    .filter((f) => !f.hidden && f.type !== 'hidden')
    .map((f) => ({
      field_id: f.field_id,
      type: f.type,
      label: f.label ?? f.nearbyText ?? f.name ?? f.id ?? null,
      name: f.name,
      autocomplete: f.autocomplete,
      required: f.required,
      pattern: f.pattern,
      options: f.options,
    }));

  if (nanoVia === 'extension') {
    const result = await sendToExtension<NanoResult>({
      type: 'RUN_NANO',
      schema: { fields: nanoFields },
      profile,
    });
    return result ?? { ok: false, plan: [], source: 'nano', error: 'No response from extension' };
  }

  try {
    const result = await sendToMainWorld({
      action: 'RUN_NANO',
      schema: { fields: nanoFields },
      profile
    }) as NanoResult;
    return result;
  } catch (err) {
    return { ok: false, plan: [], source: 'nano', error: String(err) };
  }
}

// --- Fallback ---

function generateFallbackPlan(
  schema: ReturnType<typeof scanPage>,
  profile: Record<string, string>
): { plan: Array<{ tool: string; field_id: string; value: string; confidence: number }>; source: string } {
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
    { patterns: [/date\s*of\s*birth/i, /dob/i, /birthday/i], profileKey: 'custom.dateOfBirth', tool: 'fill_field' },
    { patterns: [/gender/i, /sex/i], profileKey: 'custom.gender', tool: 'fill_field' },
    { patterns: [/nationality/i], profileKey: 'custom.nationality', tool: 'fill_field' },
    { patterns: [/newsletter/i, /subscribe/i], profileKey: 'custom.newsletter', tool: 'toggle' },
  ];
  for (const field of schema.fields) {
    if (field.hidden || field.type === 'hidden') continue;
    const label = String(field.label ?? field.nearbyText ?? '').trim();
    if (!label) continue;
    let profileKey: string | null = null;
    let tool = 'fill_field';
    for (const mapping of LABEL_MAP) {
      for (const pattern of mapping.patterns) {
        if (pattern.test(label)) { profileKey = mapping.profileKey; tool = mapping.tool; break; }
      }
      if (profileKey) break;
    }
    // No built-in mapping matched: try the user's custom profile keys by name
    if (!profileKey) {
      const labelLower = label.toLowerCase();
      for (const key of Object.keys(profile)) {
        if (!key.startsWith('custom.')) continue;
        const keyText = key.slice(7).replace(/[_-]+/g, ' ').toLowerCase().trim();
        if (keyText.length > 2 && labelLower.includes(keyText)) { profileKey = key; break; }
      }
    }
    if (!profileKey) continue;
    let value = profile[profileKey] ?? '';
    if (!value) continue;
    // Fields with options (selects, radio groups) need an option match, not raw text
    if (field.options && field.options.length > 0) {
      tool = 'select_option';
      const lower = value.toLowerCase();
      const match = field.options.find((o) => o.label.toLowerCase() === lower || o.value.toLowerCase() === lower)
        ?? field.options.find((o) => o.label.toLowerCase().includes(lower) || o.value.toLowerCase().includes(lower));
      if (!match) continue;
      value = match.value;
    }
    plan.push({ tool, field_id: field.field_id, value, confidence: 0.7 });
  }
  return { plan, source: 'fallback' };
}

// --- Fill execution ---

type PlanStep = { tool: string; field_id: string; value: string; confidence: number };

function sanitizePlan(plan: PlanStep[]): PlanStep[] {
  const byField = new Map<string, PlanStep>();
  for (const step of plan) {
    const value = String(step.value ?? '').trim();
    // Never write empty values — a blank step must not wipe a field
    if (!value && step.tool !== 'toggle') continue;
    const prev = byField.get(step.field_id);
    if (!prev || (step.confidence ?? 0) > (prev.confidence ?? 0)) {
      byField.set(step.field_id, { ...step, value });
    }
  }
  return Array.from(byField.values());
}

function applyFillPlan(plan: Array<{ tool: string; field_id: string; value: string }>): number {
  let filled = 0;
  const schema = scanPage();
  for (const step of plan) {
    const field = schema.fields.find((f) => f.field_id === step.field_id);
    if (!field) continue;
    const el = document.querySelector(field.selector);
    if (!el) continue;
    try {
      if (step.tool === 'fill_field') {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          const setter = el instanceof HTMLInputElement
            ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
            : Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
          if (setter) setter.call(el, step.value); else (el as any).value = step.value;
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
          // The plan value may be the option's value or its visible label
          const target = step.value.toLowerCase();
          const options = Array.from(el.options);
          const match = options.find((o) => o.value.toLowerCase() === target)
            ?? options.find((o) => o.text.trim().toLowerCase() === target)
            ?? options.find((o) => o.text.trim().toLowerCase().includes(target) || (target.length > 1 && o.value.toLowerCase().includes(target)));
          if (match) {
            el.value = match.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            filled++;
          }
        } else if (el.getAttribute('role') === 'listbox' || el.getAttribute('role') === 'radiogroup') {
          const opts = el.querySelectorAll('[role="option"], [role="radio"]');
          for (const opt of Array.from(opts)) {
            const dv = (opt.getAttribute('data-value') ?? opt.textContent?.trim() ?? '').toLowerCase();
            if (dv === step.value.toLowerCase() || dv.includes(step.value.toLowerCase())) {
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
          const should = step.value === 'true' || step.value === 'yes';
          if (el.checked !== should) { el.click(); filled++; }
        } else if (el.getAttribute('role') === 'checkbox') {
          const is = el.getAttribute('aria-checked') === 'true';
          const should = step.value === 'true' || step.value === 'yes';
          if (is !== should) {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            filled++;
          }
        }
      }
    } catch (err) { console.warn(`[Fillwright] Failed: ${step.field_id}`, err); }
  }
  return filled;
}

// --- Main handler ---

async function handleFill(btn?: HTMLButtonElement): Promise<void> {
  if (!enabled) return;
  if (btn) { btn.textContent = 'Scanning...'; btn.style.background = '#C5A55A'; btn.style.color = '#1B2A4A'; btn.disabled = true; }

  try {
    const rawProfile = await getProfileFromStorage();
    // Drop empty entries — they confuse Nano into echoing empty values
    const profile: Record<string, string> = {};
    for (const [key, val] of Object.entries(rawProfile)) {
      if (typeof val === 'string' && val.trim()) profile[key] = val.trim();
    }
    if (Object.keys(profile).length === 0) { showNoProfileOverlay(); return; }

    const schema = scanPage();
    console.log(`[Fillwright] Scanned ${schema.fields.length} fields:`, schema.fields);
    if (schema.fields.length === 0) { showNotification('No form fields found on this page.', 'error'); return; }

    if (btn) btn.textContent = 'Planning...';

    let source = 'fallback';
    let plan: Array<{ tool: string; field_id: string; value: string; confidence: number }> = [];

    // Try Gemini Nano via injected bridge
    try {
      const status = await callNanoCheck();
      console.log('[Fillwright] Nano status:', status);

      if (status === 'available') {
        if (btn) btn.textContent = 'Asking Gemini Nano...';
        const nanoResult = await callNanoRun(schema, profile);
        console.log('[Fillwright] Nano result:', nanoResult);

        if (nanoResult?.ok && nanoResult?.plan?.length > 0) {
          plan = nanoResult.plan;
          source = 'nano';
        } else {
          console.warn('[Fillwright] Nano failed:', nanoResult?.error);
        }
      } else if (status === 'downloadable' || status === 'downloading') {
        showNotification('Gemini Nano model is still downloading. Using pattern matching for now.', 'info');
      }
    } catch (err) {
      console.warn('[Fillwright] Nano error:', err);
    }

    // Drop empty/duplicate Nano steps before merging, so a blank step can't
    // both wipe a field and block the fallback from covering it
    plan = sanitizePlan(plan);

    // Always compute the pattern fallback; it covers fields Nano missed
    const fb = generateFallbackPlan(schema, profile);
    if (plan.length === 0) {
      plan = fb.plan;
      source = fb.source;
    } else {
      const covered = new Set(plan.map((s) => s.field_id));
      const extras = fb.plan.filter((s) => !covered.has(s.field_id));
      if (extras.length > 0) {
        plan = plan.concat(extras);
        source = 'nano+fallback';
      }
    }

    console.log(`[Fillwright] Fill plan (${source}):`, plan);

    if (plan.length === 0) {
      const labels = schema.fields.map((f) => f.label ?? f.nearbyText ?? f.type).join(', ');
      showNotification(`Found ${schema.fields.length} fields but couldn't match. Detected: ${labels}`, 'error');
      return;
    }

    if (btn) btn.textContent = `Filling ${plan.length} fields...`;
    const filled = applyFillPlan(plan);
    showNotification(`Filled ${filled}/${plan.length} fields (${source})`, 'success');
  } catch (err) {
    console.error('[Fillwright] Error:', err);
    showNotification(`Error: ${String(err)}`, 'error');
  } finally {
    if (btn) { btn.textContent = 'Fill Form'; btn.style.background = '#1B2A4A'; btn.style.color = 'white'; btn.disabled = false; }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'FILL_FORM') {
    handleFill().then(() => sendResponse({ filled: true })).catch((err) => sendResponse({ filled: false, error: String(err) }));
    return true;
  }
  if (msg.type === 'TOGGLE_FILLWRIGHT') {
    enabled = msg.enabled;
    if (enabled) injectFillwrightUI(); else removeFillwrightUI();
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === 'PING') { sendResponse({ pong: true }); return false; }
  return false;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => injectFillwrightUI());
} else {
  injectFillwrightUI();
}

observeChanges(() => {
  if (enabled && !document.getElementById('fillwright-ext-btn')) injectFillwrightUI();
});
