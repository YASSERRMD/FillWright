// Fillwright Background Service Worker
// Handles extension lifecycle and messaging

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default empty profile on first install
    chrome.storage.local.set({
      profiles: {},
      activeProfile: '',
      enabled: true,
    });
    console.log('[Fillwright] Extension installed');
  }
});

// Handle messages between popup and content scripts
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
