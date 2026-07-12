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

function applyFillPlan(plan: Array<{ tool: string; field_id: string; value: string }>): number {
  let filled = 0;

  for (const step of plan) {
    const schema = scanPage();
    const field = schema.fields.find((f) => f.field_id === step.field_id);
    if (!field) continue;

    const el = document.querySelector(field.selector);
    if (!el) continue;

    if (step.tool === 'fill_field') {
      // Handle standard inputs
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
      }
      // Handle Google Forms role="textbox"
      else if (el.getAttribute('role') === 'textbox' || el.getAttribute('contenteditable') === 'true') {
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

function requestFillPlan(
  schema: ReturnType<typeof scanPage>,
  profile: Record<string, string>
): Promise<{ ok: boolean; plan: Array<{ tool: string; field_id: string; value: string }>; source: string; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GENERATE_FILL_PLAN', schema, profile },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, plan: [], source: 'error', error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response ?? { ok: false, plan: [], source: 'error', error: 'No response' });
      }
    );
  });
}

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

    const result = await requestFillPlan(schema, profile);

    if (!result.ok) {
      showNotification(`Error: ${result.error}`, 'error');
      return;
    }

    console.log(`[Fillwright] Fill plan (${result.source}):`, result.plan);

    if (result.plan.length === 0) {
      const fieldLabels = schema.fields.map((f) => f.label ?? f.nearbyText ?? f.name ?? f.type).join(', ');
      showNotification(
        `Found ${schema.fields.length} fields but couldn't match any to your profile. Detected: ${fieldLabels}`,
        'error'
      );
      return;
    }

    if (btn) {
      btn.textContent = `Filling ${result.plan.length} fields...`;
    }

    const filled = applyFillPlan(result.plan);
    showNotification(`Filled ${filled} of ${result.plan.length} fields (${result.source})`, 'success');
  } catch (err) {
    console.error('[Fillwright] Error:', err);
    if (String(err).includes('Extension context invalidated')) {
      showNotification('Extension was updated. Reload this page to use Fillwright.', 'error');
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

// Listen for messages from popup
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
