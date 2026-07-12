// Fillwright Main World Script
// Runs in the page's main world — has access to window.LanguageModel / window.ai

const w = window as any;
console.log('[Fillwright MAIN] window.LanguageModel:', typeof w.LanguageModel);
console.log('[Fillwright MAIN] window.ai:', typeof w.ai);

function getLanguageModel(): any {
  if (typeof w.LanguageModel === 'function') return w.LanguageModel;
  if (typeof w.LanguageModel === 'object' && w.LanguageModel) return w.LanguageModel;
  if (w.ai) {
    if (w.ai.languageModel) return w.ai.languageModel;
    if (w.ai.originTrial && w.ai.originTrial.languageModel) return w.ai.originTrial.languageModel;
  }
  return null;
}

const SYSTEM_PROMPT = `You are a form-filling assistant. You map profile data to form fields.

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

async function checkNano(): Promise<string> {
  const LM = getLanguageModel();
  if (!LM) return 'unavailable';
  try {
    if (typeof LM.availability === 'function') {
      return await LM.availability();
    }
    return 'available';
  } catch {
    return 'unavailable';
  }
}

async function runNano(
  schema: { fields: Array<Record<string, unknown>> },
  profile: Record<string, string>
): Promise<{ ok: boolean; plan: Array<Record<string, unknown>>; source: string; error?: string }> {
  const LM = getLanguageModel();
  if (!LM) return { ok: false, plan: [], source: 'nano', error: 'LanguageModel not found on window' };

  try {
    if (typeof LM.availability === 'function') {
      const status = await LM.availability();
      if (status !== 'available') {
        return { ok: false, plan: [], source: 'nano', error: 'Model status: ' + status };
      }
    }

    let session: any = null;

    if (typeof LM.create === 'function') {
      session = await LM.create({ systemPrompt: SYSTEM_PROMPT, outputLanguage: 'en' });
    } else if (typeof LM.createSession === 'function') {
      session = await LM.createSession({ systemPrompt: SYSTEM_PROMPT, outputLanguage: 'en' });
    } else if (typeof LM === 'function') {
      session = await LM({ systemPrompt: SYSTEM_PROMPT, outputLanguage: 'en' });
    } else {
      return { ok: false, plan: [], source: 'nano', error: 'LM methods: ' + Object.keys(LM).join(', ') };
    }

    const prompt = 'Given this form schema:\n' + JSON.stringify(schema) + '\n\nAnd this user profile:\n' + JSON.stringify(profile) + '\n\nMap profile data to form fields. Return a JSON array of fill steps.';

    console.log('[Fillwright MAIN] Calling Gemini Nano...');
    const raw = await session.prompt(prompt);
    if (typeof session.destroy === 'function') session.destroy();
    console.log('[Fillwright MAIN] Raw response:', raw);

    let cleaned = raw.trim();
    const fence = '```';
    if (cleaned.indexOf(fence) === 0) {
      cleaned = cleaned.slice(3);
      if (cleaned.indexOf('json') === 0) cleaned = cleaned.slice(4);
    }
    if (cleaned.length > 3 && cleaned.slice(-3) === fence) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    // Extract JSON array — model may return prose before/after the JSON
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return { ok: false, plan: [], source: 'nano', error: 'Not an array' };

    const VALID_TOOLS: Record<string, boolean> = { fill_field: true, select_option: true, toggle: true };
    const validSteps = parsed.filter(function(s: any) {
      return VALID_TOOLS[s.tool] && typeof s.field_id === 'string' && typeof s.value === 'string' && typeof s.confidence === 'number';
    });

    return { ok: true, plan: validSteps, source: 'nano' };
  } catch (err) {
    console.error('[Fillwright MAIN] Error:', err);
    return { ok: false, plan: [], source: 'nano', error: String(err) };
  }
}

window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== 'FILLWRIGHT_NANO_REQUEST') return;

  const { id, action, schema, profile } = event.data;

  if (action === 'CHECK_NANO') {
    checkNano().then(function(status) {
      window.postMessage({ type: 'FILLWRIGHT_NANO_RESPONSE', id: id, result: { status: status } }, '*');
    });
  }

  if (action === 'RUN_NANO') {
    runNano(schema, profile).then(function(result) {
      window.postMessage({ type: 'FILLWRIGHT_NANO_RESPONSE', id: id, result: result }, '*');
    });
  }
});

console.log('[Fillwright MAIN] Ready');
