import type { ToolResult } from '../types';
import { scanPage } from '../../scanner/index';

function setGoogleFormsText(el: Element, value: string): void {
  // Google Forms textboxes use contenteditable divs or role="textbox"
  if (el.getAttribute('role') === 'textbox' || el.getAttribute('contenteditable') === 'true') {
    el.textContent = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // Standard inputs
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;

  const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set;

  if (el instanceof HTMLInputElement && nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else if (el instanceof HTMLTextAreaElement && nativeTextareaValueSetter) {
    nativeTextareaValueSetter.call(el, value);
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.value = value;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function fillField(fieldId: string, value: string): ToolResult {
  const schema = scanPage();
  const field = schema.fields.find((f) => f.field_id === fieldId);

  if (!field) {
    return { ok: false, field_id: fieldId, error: `Field not found: ${fieldId}` };
  }

  const el = document.querySelector(field.selector);
  if (!el) {
    return { ok: false, field_id: fieldId, error: `Element not found for selector: ${field.selector}` };
  }

  // Handle Google Forms textbox
  if (field.type === 'text' && (el.getAttribute('role') === 'textbox' || el.getAttribute('contenteditable') === 'true')) {
    setGoogleFormsText(el, value);
    return { ok: true, field_id: fieldId, applied_value: value };
  }

  // Standard inputs
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    return { ok: false, field_id: fieldId, error: `Element is not an input or textarea` };
  }

  setGoogleFormsText(el, value);

  return { ok: true, field_id: fieldId, applied_value: value };
}
