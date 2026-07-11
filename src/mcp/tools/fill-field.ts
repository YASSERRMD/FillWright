import type { ToolResult } from '../types';
import { scanPage } from '../../scanner/index';
import { setNativeValue } from '../dom';

export function fillField(fieldId: string, value: string): ToolResult {
  const schema = scanPage();
  const field = schema.fields.find((f) => f.field_id === fieldId);

  if (!field) {
    return { ok: false, field_id: fieldId, error: `Field not found: ${fieldId}` };
  }

  const el = document.querySelector(field.selector) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) {
    return { ok: false, field_id: fieldId, error: `Element not found for selector: ${field.selector}` };
  }

  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    return { ok: false, field_id: fieldId, error: `Element is not an input or textarea` };
  }

  setNativeValue(el, value);

  return { ok: true, field_id: fieldId, applied_value: value };
}
