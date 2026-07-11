import type { PromptBuilderOptions } from './types';

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

export function buildPrompt(options: PromptBuilderOptions): string {
  return `Given this form schema:
${options.schemaJson}

And this user profile:
${options.profileJson}

Map profile data to form fields. Return a JSON array of fill steps.`;
}

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function trimSchemaToTokenBudget(
  schema: { fields: Array<{ field_id: string; label: string | null; type: string; options?: Array<{ value: string; label: string }> | null }> },
  maxFields: number
): typeof schema {
  if (schema.fields.length <= maxFields) {
    return schema;
  }

  return {
    ...schema,
    fields: schema.fields.slice(0, maxFields),
  };
}

export function trimProfileToTokenBudget(
  profile: Record<string, string>,
  maxKeys: number
): Record<string, string> {
  const keys = Object.keys(profile);
  if (keys.length <= maxKeys) {
    return profile;
  }

  const trimmed: Record<string, string> = {};
  for (let i = 0; i < maxKeys; i++) {
    const key = keys[i]!;
    trimmed[key] = profile[key]!;
  }
  return trimmed;
}
