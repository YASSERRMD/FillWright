// Fillwright Background Service Worker
// Handles extension lifecycle, messaging, and Gemini Nano

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

// Gemini Nano helpers (available in service worker context)
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

async function generateFillPlanWithNano(
  schema: { fields: Array<Record<string, unknown>> },
  profile: Record<string, string>
): Promise<{ ok: true; plan: Array<Record<string, unknown>>; source: 'nano' } | { ok: false; error: string }> {
  try {
    const LM = (globalThis as Record<string, unknown>)['LanguageModel'] as {
      availability: () => Promise<string>;
      createSession: (opts: { systemPrompt: string }) => Promise<{
        prompt: (input: string) => Promise<string>;
        destroy: () => void;
      }>;
    } | undefined;

    if (!LM) {
      return { ok: false, error: 'LanguageModel not available' };
    }

    const status = await LM.availability();
    if (status !== 'available') {
      return { ok: false, error: `Model status: ${status}` };
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
      return { ok: false, error: 'Invalid JSON from model' };
    }

    if (!Array.isArray(parsed)) {
      return { ok: false, error: 'Response is not an array' };
    }

    const validSteps = (parsed as unknown[]).filter(validateStep);
    if (validSteps.length === 0) {
      return { ok: false, error: 'No valid steps in model response' };
    }

    return { ok: true, plan: validSteps as Array<Record<string, unknown>>, source: 'nano' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Fallback plan (regex-based)
function generateFallbackPlan(
  schema: { fields: Array<Record<string, unknown>> },
  profile: Record<string, string>
): Array<Record<string, unknown>> {
  const plan: Array<Record<string, unknown>> = [];

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
  ];

  for (const field of schema.fields) {
    if (field.hidden || field.type === 'hidden') continue;

    const label = String(field.label ?? field.nearbyText ?? '').trim();
    if (!label) continue;

    let profileKey: string | null = null;
    let tool = 'fill_field';

    for (const mapping of LABEL_MAP) {
      for (const pattern of mapping.patterns) {
        if (pattern.test(label)) {
          profileKey = mapping.profileKey;
          tool = mapping.tool;
          break;
        }
      }
      if (profileKey) break;
    }

    if (!profileKey) continue;

    const value = profile[profileKey] ?? '';
    if (!value) continue;

    plan.push({ tool, field_id: field.field_id, value, confidence: 0.7 });
  }

  return plan;
}

// Handle messages
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

  if (msg.type === 'GENERATE_FILL_PLAN') {
    const { schema, profile } = msg as { schema: { fields: Array<Record<string, unknown>> }; profile: Record<string, string> };

    // Try Gemini Nano first
    generateFillPlanWithNano(schema, profile).then((result) => {
      if (result.ok) {
        sendResponse({ ok: true, plan: result.plan, source: 'nano' });
      } else {
        // Fallback to regex
        const plan = generateFallbackPlan(schema, profile);
        sendResponse({ ok: true, plan, source: 'fallback' });
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
