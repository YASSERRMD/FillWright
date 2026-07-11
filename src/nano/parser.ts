import type { FillPlan, FillPlanStep } from './types';

const VALID_TOOLS = new Set(['fill_field', 'select_option', 'toggle']);
const MIN_CONFIDENCE = 0.5;

export function stripMarkdownFences(input: string): string {
  let cleaned = input.trim();

  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  cleaned = cleaned.replace(/^~~~(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?~~~\s*$/i, '');

  return cleaned.trim();
}

export function validateStep(step: unknown): step is FillPlanStep {
  if (!step || typeof step !== 'object') return false;
  const obj = step as Record<string, unknown>;

  if (typeof obj.tool !== 'string' || !VALID_TOOLS.has(obj.tool)) return false;
  if (typeof obj.field_id !== 'string' || obj.field_id.length === 0) return false;
  if (typeof obj.value !== 'string') return false;
  if (typeof obj.confidence !== 'number') return false;

  return true;
}

export function filterByConfidence(plan: FillPlan, minConfidence: number = MIN_CONFIDENCE): FillPlan {
  return plan.filter((step) => step.confidence >= minConfidence);
}

export function parseFillPlan(raw: string): { ok: true; plan: FillPlan } | { ok: false; error: string } {
  const cleaned = stripMarkdownFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'Response is not an array' };
  }

  const validSteps: FillPlanStep[] = [];
  const invalidSteps: unknown[] = [];

  for (const item of parsed) {
    if (validateStep(item)) {
      validSteps.push(item);
    } else {
      invalidSteps.push(item);
    }
  }

  if (validSteps.length === 0 && parsed.length > 0) {
    return { ok: false, error: 'No valid steps found in response' };
  }

  const filtered = filterByConfidence(validSteps);

  return { ok: true, plan: filtered };
}
