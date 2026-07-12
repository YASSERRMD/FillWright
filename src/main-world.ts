// Fillwright Main World Script
// Runs in the page's main world context — has access to window.LanguageModel
// Communicates with the isolated content script via window.postMessage

console.log('[Fillwright MAIN] Loaded. LanguageModel:', typeof (window as any).LanguageModel);

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LM = (window as any).LanguageModel;
  if (!LM) return 'unavailable';
  try {
    return await LM.availability();
  } catch {
    return 'unavailable';
  }
}

async function runNano(
  schema: { fields: Array<Record<string, unknown>> },
  profile: Record<string, string>
): Promise<{ ok: boolean; plan: Array<Record<string, unknown>>; source: string; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LM = (window as any).LanguageModel;
  if (!LM) return { ok: false, plan: [], source: 'nano', error: 'LanguageModel not available' };

  try {
    const status = await LM.availability();
    if (status !== 'available') {
      return { ok: false, plan: [], source: 'nano', error: `Model status: ${status}` };
    }

    const session = await LM.createSession({ systemPrompt: SYSTEM_PROMPT });
    const prompt = `Given this form schema:\n${JSON.stringify(schema)}\n\nAnd this user profile:\n${JSON.stringify(profile)}\n\nMap profile data to form fields. Return a JSON array of fill steps.`;

    console.log('[Fillwright MAIN] Calling Gemini Nano...');
    const raw = await session.prompt(prompt);
    session.destroy();
    console.log('[Fillwright MAIN] Response:', raw);

    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);

    const parsed = JSON.parse(cleaned.trim());
    if (!Array.isArray(parsed)) return { ok: false, plan: [], source: 'nano', error: 'Not an array' };

    const VALID_TOOLS = new Set(['fill_field', 'select_option', 'toggle']);
    const validSteps = parsed.filter((s: any) =>
      VALID_TOOLS.has(s.tool) && typeof s.field_id === 'string' && typeof s.value === 'string' && typeof s.confidence === 'number'
    );

    return { ok: true, plan: validSteps, source: 'nano' };
  } catch (err) {
    console.error('[Fillwright MAIN] Error:', err);
    return { ok: false, plan: [], source: 'nano', error: String(err) };
  }
}

// Listen for requests from isolated content script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'FILLWRIGHT_NANO_REQUEST') return;

  const { id, action, schema, profile } = event.data;

  if (action === 'CHECK_NANO') {
    checkNano().then((status) => {
      window.postMessage({ type: 'FILLWRIGHT_NANO_RESPONSE', id, result: { status } }, '*');
    });
  }

  if (action === 'RUN_NANO') {
    runNano(schema, profile).then((result) => {
      window.postMessage({ type: 'FILLWRIGHT_NANO_RESPONSE', id, result }, '*');
    });
  }
});

console.log('[Fillwright MAIN] Ready');
