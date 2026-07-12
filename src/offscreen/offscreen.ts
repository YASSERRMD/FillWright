// Fillwright Offscreen Document
// This runs in the page context and has access to window.LanguageModel

console.log('[Fillwright Offscreen] Loaded. window.LanguageModel:', typeof (window as any).LanguageModel);
console.log('[Fillwright Offscreen] window.ai:', typeof (window as any).ai);

async function checkNanoAvailability(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LM = (window as any).LanguageModel;
  if (!LM) {
    console.log('[Fillwright Offscreen] LanguageModel not found on window');
    return 'unavailable';
  }
  try {
    const status = await LM.availability();
    console.log('[Fillwright Offscreen] LanguageModel status:', status);
    return status as string;
  } catch (err) {
    console.error('[Fillwright Offscreen] LanguageModel error:', err);
    return 'unavailable';
  }
}

async function runNanoPlan(
  schema: { fields: Array<Record<string, unknown>> },
  profile: Record<string, string>
): Promise<{ ok: boolean; plan: Array<Record<string, unknown>>; source: string; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LM = (window as any).LanguageModel;
  if (!LM) {
    return { ok: false, plan: [], source: 'nano', error: 'LanguageModel not available' };
  }

  try {
    const status = await LM.availability();
    if (status !== 'available') {
      return { ok: false, plan: [], source: 'nano', error: `Model status: ${status}` };
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

    const session = await LM.createSession({ systemPrompt: SYSTEM_PROMPT });
    const prompt = `Given this form schema:
${JSON.stringify(schema)}

And this user profile:
${JSON.stringify(profile)}

Map profile data to form fields. Return a JSON array of fill steps.`;

    console.log('[Fillwright Offscreen] Sending prompt to Gemini Nano...');
    const raw = await session.prompt(prompt);
    session.destroy();
    console.log('[Fillwright Offscreen] Raw response:', raw);

    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);

    const parsed = JSON.parse(cleaned.trim());
    if (!Array.isArray(parsed)) {
      return { ok: false, plan: [], source: 'nano', error: 'Not an array' };
    }

    const VALID_TOOLS = new Set(['fill_field', 'select_option', 'toggle']);
    const validSteps = parsed.filter((s: any) =>
      VALID_TOOLS.has(s.tool) && typeof s.field_id === 'string' && typeof s.value === 'string' && typeof s.confidence === 'number'
    );

    return { ok: true, plan: validSteps, source: 'nano' };
  } catch (err) {
    return { ok: false, plan: [], source: 'nano', error: String(err) };
  }
}

// Listen for messages from background worker
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log('[Fillwright Offscreen] Received message:', msg.type);

  if (msg.type === 'CHECK_NANO') {
    checkNanoAvailability().then((status) => {
      sendResponse({ status });
    });
    return true;
  }

  if (msg.type === 'RUN_NANO') {
    runNanoPlan(msg.schema, msg.profile).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  return false;
});

console.log('[Fillwright Offscreen] Document ready');
