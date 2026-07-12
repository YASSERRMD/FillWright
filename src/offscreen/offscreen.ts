// Fillwright Offscreen Document
// This runs in the page context and has access to window.LanguageModel

function getSystemPrompt(): string {
  return `You are a form-filling assistant. You map profile data to form fields.

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
}

function buildPrompt(schemaJson: string, profileJson: string): string {
  return `Given this form schema:
${schemaJson}

And this user profile:
${profileJson}

Map profile data to form fields. Return a JSON array of fill steps.`;
}

function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

function validateStep(step: unknown): boolean {
  const VALID_TOOLS = new Set(['fill_field', 'select_option', 'toggle']);
  const obj = step as Record<string, unknown>;
  if (typeof obj !== 'object' || obj === null) return false;
  if (typeof obj.tool !== 'string' || !VALID_TOOLS.has(obj.tool)) return false;
  if (typeof obj.field_id !== 'string' || obj.field_id.length === 0) return false;
  if (typeof obj.value !== 'string') return false;
  if (typeof obj.confidence !== 'number') return false;
  return true;
}

async function checkNanoAvailability(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LM = (window as any).LanguageModel;
  if (!LM) return 'unavailable';
  try {
    return await LM.availability();
  } catch {
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

    const session = await LM.createSession({ systemPrompt: getSystemPrompt() });
    const prompt = buildPrompt(JSON.stringify(schema), JSON.stringify(profile));
    const raw = await session.prompt(prompt);
    session.destroy();

    const cleaned = stripMarkdownFences(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { ok: false, plan: [], source: 'nano', error: 'Invalid JSON from model' };
    }

    if (!Array.isArray(parsed)) {
      return { ok: false, plan: [], source: 'nano', error: 'Response is not an array' };
    }

    const validSteps = (parsed as unknown[]).filter(validateStep);
    if (validSteps.length === 0) {
      return { ok: false, plan: [], source: 'nano', error: 'No valid steps in response' };
    }

    return { ok: true, plan: validSteps as Array<Record<string, unknown>>, source: 'nano' };
  } catch (err) {
    return { ok: false, plan: [], source: 'nano', error: String(err) };
  }
}

// Listen for messages from background worker
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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

console.log('[Fillwright] Offscreen document loaded');
