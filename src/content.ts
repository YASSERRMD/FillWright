import { scanPage, observeChanges } from './scanner';
// @ts-ignore
import bridgeCode from './bridge.js?raw';

let enabled = true;

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

// --- Inject Gemini Nano bridge into page context via <script> tag ---

function injectNanoBridge(): void {
  if (document.getElementById('fillwright-nano-bridge')) return;

  const script = document.createElement('script');
  script.id = 'fillwright-nano-bridge';
  script.textContent = bridgeCode;
  (document.head || document.documentElement).appendChild(script);
}

// Call the injected bridge
async function callNanoCheck(): Promise<string> {
  injectNanoBridge();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (window as any).__fillwrightNanoCheck();
  } catch {
    return 'unavailable';
  }
}

async function callNanoRun(
  schema: ReturnType<typeof scanPage>,
  profile: Record<string, string>
): Promise<{ ok: boolean; plan: Array<{ tool: string; field_id: string; value: string; confidence: number }>; source: string; error?: string }> {
  injectNanoBridge();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (window as any).__fillwrightNanoRun(
      JSON.stringify({ fields: schema.fields }),
      JSON.stringify(profile)
    );
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
    if (!profileKey) continue;
    const value = profile[profileKey] ?? '';
    if (!value) continue;
    if (tool === 'select_option' && field.options) {
      const match = field.options.find((o) => o.label.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase().includes(value.toLowerCase()));
      if (!match) continue;
    }
    plan.push({ tool, field_id: field.field_id, value, confidence: 0.7 });
  }
  return { plan, source: 'fallback' };
}

// --- Fill execution ---

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
          el.value = step.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          filled++;
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
    const profile = await getProfileFromStorage();
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
      }
    } catch (err) {
      console.warn('[Fillwright] Nano error:', err);
    }

    // Fallback
    if (plan.length === 0) {
      const fb = generateFallbackPlan(schema, profile);
      plan = fb.plan;
      source = fb.source;
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
