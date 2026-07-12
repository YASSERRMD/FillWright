// Fillwright Background Service Worker
// Handles extension lifecycle, messaging, and offscreen document

let offscreenCreated = false;

async function ensureOffscreen(): Promise<void> {
  if (offscreenCreated) return;

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER' as chrome.offscreen.Reason],
      justification: 'Gemini Nano LanguageModel API requires page context',
    });
    offscreenCreated = true;
    console.log('[Fillwright] Offscreen document created');
  } catch (err) {
    console.warn('[Fillwright] Offscreen creation error:', err);
    // May already exist
    offscreenCreated = true;
  }
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
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({ type: 'CHECK_NANO' }, (response) => {
        sendResponse(response);
      });
    });
    return true;
  }

  if (msg.type === 'RUN_NANO') {
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage(
        { type: 'RUN_NANO', schema: msg.schema, profile: msg.profile },
        (response) => {
          sendResponse(response);
        }
      );
    });
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
