import type { FillPlan, NanoStatus } from './types';
import type { FormSchema } from '../types';
import { checkAvailability, downloadModel } from './availability';
import { createSession, getSession, resetSession } from './session';
import { buildPrompt, getSystemPrompt, trimSchemaToTokenBudget, trimProfileToTokenBudget } from './prompt';
import { parseFillPlan } from './parser';
import { generateFallbackPlan } from './fallback';

export type { FillPlan, FillPlanStep, NanoStatus, NanoSession } from './types';

export { checkAvailability, downloadModel } from './availability';
export { createSession, getSession, resetSession } from './session';
export { buildPrompt, getSystemPrompt, trimSchemaToTokenBudget, trimProfileToTokenBudget } from './prompt';
export { parseFillPlan, stripMarkdownFences, validateStep, filterByConfidence } from './parser';
export { generateFallbackPlan } from './fallback';

const MAX_SCHEMA_FIELDS = 50;
const MAX_PROFILE_KEYS = 40;

export async function getStatus(): Promise<NanoStatus> {
  return checkAvailability();
}

export async function generateFillPlan(
  schema: FormSchema,
  profile: Record<string, string>
): Promise<{ ok: true; plan: FillPlan; source: 'nano' | 'fallback' } | { ok: false; error: string }> {
  const status = await checkAvailability();

  if (status !== 'available') {
    const plan = generateFallbackPlan(schema, profile);
    return { ok: true, plan, source: 'fallback' };
  }

  try {
    let session = getSession();
    if (!session) {
      session = await createSession(getSystemPrompt());
    }

    const trimmedSchema = trimSchemaToTokenBudget(schema, MAX_SCHEMA_FIELDS);
    const trimmedProfile = trimProfileToTokenBudget(profile, MAX_PROFILE_KEYS);

    const prompt = buildPrompt({
      schemaJson: JSON.stringify(trimmedSchema),
      profileJson: JSON.stringify(trimmedProfile),
    });

    const raw = await session.prompt(prompt);
    const result = parseFillPlan(raw);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true, plan: result.plan, source: 'nano' };
  } catch (err) {
    const fallbackPlan = generateFallbackPlan(schema, profile);
    return { ok: true, plan: fallbackPlan, source: 'fallback' };
  }
}
