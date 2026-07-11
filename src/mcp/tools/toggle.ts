import type { ToolResult } from '../types';
import { scanPage } from '../../scanner/index';
import { setNativeChecked } from '../dom';

export function toggle(fieldId: string, state: boolean): ToolResult {
  const schema = scanPage();
  const field = schema.fields.find((f) => f.field_id === fieldId);

  if (!field) {
    return { ok: false, field_id: fieldId, error: `Field not found: ${fieldId}` };
  }

  if (field.type !== 'checkbox') {
    return { ok: false, field_id: fieldId, error: `Field is not a checkbox` };
  }

  const el = document.querySelector(field.selector) as HTMLInputElement | null;
  if (!el) {
    return { ok: false, field_id: fieldId, error: `Element not found for selector: ${field.selector}` };
  }

  setNativeChecked(el, state);

  return { ok: true, field_id: fieldId, applied_value: String(state) };
}
