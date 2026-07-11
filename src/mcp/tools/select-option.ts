import type { ToolResult } from '../types';
import { scanPage } from '../../scanner/index';
import { setNativeSelectValue } from '../dom';

function fuzzyMatch(target: string, options: { value: string; label: string }[]): { value: string; label: string } | null {
  const normalizedTarget = target.toLowerCase().trim();

  const exact = options.find(
    (opt) => opt.value.toLowerCase() === normalizedTarget || opt.label.toLowerCase() === normalizedTarget
  );
  if (exact) return exact;

  const partial = options.find(
    (opt) =>
      opt.label.toLowerCase().includes(normalizedTarget) ||
      opt.value.toLowerCase().includes(normalizedTarget)
  );
  if (partial) return partial;

  const words = normalizedTarget.split(/\s+/);
  const wordMatch = options.find((opt) =>
    words.every((word) => opt.label.toLowerCase().includes(word))
  );
  if (wordMatch) return wordMatch;

  return null;
}

export function selectOption(fieldId: string, value: string): ToolResult {
  const schema = scanPage();
  const field = schema.fields.find((f) => f.field_id === fieldId);

  if (!field) {
    return { ok: false, field_id: fieldId, error: `Field not found: ${fieldId}` };
  }

  if (field.type !== 'select-one' && field.type !== 'select-multiple') {
    return { ok: false, field_id: fieldId, error: `Field is not a select element` };
  }

  const el = document.querySelector(field.selector) as HTMLSelectElement | null;
  if (!el) {
    return { ok: false, field_id: fieldId, error: `Element not found for selector: ${field.selector}` };
  }

  const options = field.options ?? [];
  const match = fuzzyMatch(value, options);

  if (!match) {
    return { ok: false, field_id: fieldId, error: `No matching option found for: ${value}` };
  }

  setNativeSelectValue(el, match.value);

  return { ok: true, field_id: fieldId, applied_value: match.value };
}
