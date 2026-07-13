// Fillwright Offscreen Document
// Runs as an extension page, where Chrome exposes the Gemini Nano Prompt API
// (window.LanguageModel). Regular web pages do not get this API, so form-fill
// planning is routed here: content script -> background -> offscreen.

/* eslint-disable @typescript-eslint/no-explicit-any */

export {};

const w = window as any;
console.log('[Fillwright Offscreen] Loaded. window.LanguageModel:', typeof w.LanguageModel);
console.log('[Fillwright Offscreen] window.ai:', typeof w.ai);

function getLanguageModel(): any {
  if (typeof w.LanguageModel === 'function') return w.LanguageModel;
  if (typeof w.LanguageModel === 'object' && w.LanguageModel) return w.LanguageModel;
  if (w.ai) {
    if (w.ai.languageModel) return w.ai.languageModel;
    if (w.ai.originTrial && w.ai.originTrial.languageModel) return w.ai.originTrial.languageModel;
  }
  return null;
}

async function checkNanoAvailability(): Promise<string> {
  const LM = getLanguageModel();
  if (!LM) {
    console.log('[Fillwright Offscreen] LanguageModel not found on window');
    return 'unavailable';
  }
  try {
    if (typeof LM.availability === 'function') {
      const status = await LM.availability();
      console.log('[Fillwright Offscreen] LanguageModel status:', status);
      return status as string;
    }
    return 'available';
  } catch (err) {
    console.error('[Fillwright Offscreen] LanguageModel error:', err);
    return 'unavailable';
  }
}

async function runNanoPlan(
  schema: { fields: Array<Record<string, unknown>> },
  profile: Record<string, string>
): Promise<{ ok: boolean; plan: Array<Record<string, unknown>>; source: string; error?: string }> {
  const LM = getLanguageModel();
  if (!LM) {
    return { ok: false, plan: [], source: 'nano', error: 'LanguageModel not available' };
  }

  try {
    if (typeof LM.availability === 'function') {
      const status = await LM.availability();
      if (status !== 'available') {
        return { ok: false, plan: [], source: 'nano', error: `Model status: ${status}` };
      }
    }

    console.log('[Fillwright Offscreen] Creating session...');
    const session = await LM.create();

    const schemaStr = JSON.stringify({ fields: schema.fields });
    const profileStr = JSON.stringify(profile);
    const userPrompt =
      'Given this form schema:\n' + schemaStr +
      '\n\nAnd this user profile:\n' + profileStr +
      '\n\nReturn ONLY a JSON array. Each element: {"tool":"fill_field"|"select_option"|"toggle","field_id":"...","value":"...","confidence":0.0-1.0}. No prose.';

    console.log('[Fillwright Offscreen] Sending prompt to Gemini Nano...');
    const raw = await session.prompt(userPrompt);
    if (typeof session.destroy === 'function') session.destroy();
    console.log('[Fillwright Offscreen] Raw response:', raw);

    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
      if (cleaned.startsWith('json')) cleaned = cleaned.slice(4);
    }
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      return { ok: false, plan: [], source: 'nano', error: 'Not an array' };
    }

    const VALID_TOOLS = new Set(['fill_field', 'select_option', 'toggle']);
    // Normalize instead of dropping: coerce numeric values to strings and
    // default a missing confidence, so usable steps aren't silently lost.
    const validSteps = parsed
      .filter((s: any) => s && VALID_TOOLS.has(s.tool) && typeof s.field_id === 'string' && s.value !== undefined && s.value !== null)
      .map((s: any) => ({
        tool: s.tool,
        field_id: s.field_id,
        value: String(s.value),
        confidence: typeof s.confidence === 'number' ? s.confidence : 0.7,
      }))
      .filter((s: any) => s.value.trim() !== '');

    return { ok: true, plan: validSteps, source: 'nano' };
  } catch (err) {
    console.error('[Fillwright Offscreen] Error:', err);
    return { ok: false, plan: [], source: 'nano', error: String(err) };
  }
}

// Listen for messages forwarded by the background worker.
// Uses OFFSCREEN_* types so broadcasts from content scripts are not
// double-handled here and by the background listener.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'OFFSCREEN_CHECK_NANO') {
    checkNanoAvailability().then((status) => {
      sendResponse({ status });
    });
    return true;
  }

  if (msg.type === 'OFFSCREEN_RUN_NANO') {
    runNanoPlan(msg.schema, msg.profile).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  return false;
});

console.log('[Fillwright Offscreen] Document ready');
