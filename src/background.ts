// Fillwright Background Service Worker
// Handles extension lifecycle, messaging, and offscreen document

async function hasOffscreen(): Promise<boolean> {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
    });
    return contexts.length > 0;
  } catch {
    return false;
  }
}

async function ensureOffscreen(): Promise<void> {
  if (await hasOffscreen()) return;

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER' as chrome.offscreen.Reason],
      justification: 'Gemini Nano LanguageModel API requires an extension page context',
    });
    console.log('[Fillwright] Offscreen document created');
  } catch (err) {
    // Racing "already exists" errors are fine; anything else is logged
    console.warn('[Fillwright] Offscreen creation error:', err);
  }
}

function forwardToOffscreen(
  message: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
  fallback: Record<string, unknown>
): void {
  ensureOffscreen().then(() => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError || response === undefined) {
        console.warn('[Fillwright] Offscreen unreachable:', chrome.runtime.lastError?.message);
        sendResponse(fallback);
        return;
      }
      sendResponse(response);
    });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      profiles: {},
      activeProfile: '',
      enabled: true,
    });
    console.log('[Fillwright] Extension installed');
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATUS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'PING' }, (response) => {
          sendResponse({ active: !!response?.pong });
        });
      } else {
        sendResponse({ active: false });
      }
    });
    return true;
  }

  if (msg.type === 'GET_PROFILE') {
    chrome.storage.local.get(['profiles', 'activeProfile'], (data) => {
      const profiles = (data.profiles ?? {}) as Record<string, Record<string, string>>;
      const active = (data.activeProfile as string) ?? '';
      sendResponse({ profile: profiles[active] ?? {} });
    });
    return true;
  }

  if (msg.type === 'CHECK_NANO') {
    forwardToOffscreen(
      { type: 'OFFSCREEN_CHECK_NANO' },
      sendResponse,
      { status: 'unavailable' }
    );
    return true;
  }

  if (msg.type === 'RUN_NANO') {
    forwardToOffscreen(
      { type: 'OFFSCREEN_RUN_NANO', schema: msg.schema, profile: msg.profile },
      sendResponse,
      { ok: false, plan: [], source: 'nano', error: 'Offscreen document unreachable' }
    );
    return true;
  }

  if (msg.type === 'FILL_FORM') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, msg, (response) => {
          sendResponse(response);
        });
      } else {
        sendResponse({ filled: false, error: 'No active tab' });
      }
    });
    return true;
  }

  return false;
});
