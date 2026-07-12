import type { ToolResult } from '../types';
import { scanPage } from '../../scanner/index';

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

function setGoogleFormsRadio(groupEl: Element, value: string): boolean {
  const options = groupEl.querySelectorAll('[role="radio"]');
  for (const opt of Array.from(options)) {
    const dataValue = opt.getAttribute('data-value') ?? opt.textContent?.trim() ?? '';
    const ariaLabel = opt.getAttribute('aria-label') ?? '';

    if (
      dataValue.toLowerCase() === value.toLowerCase() ||
      ariaLabel.toLowerCase().includes(value.toLowerCase())
    ) {
      opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    }
  }
  return false;
}

function setGoogleFormsListbox(listboxEl: Element, value: string): boolean {
  const options = listboxEl.querySelectorAll('[role="option"]');
  for (const opt of Array.from(options)) {
    const dataValue = opt.getAttribute('data-value') ?? opt.textContent?.trim() ?? '';
    const ariaLabel = opt.getAttribute('aria-label') ?? '';

    if (
      dataValue.toLowerCase() === value.toLowerCase() ||
      ariaLabel.toLowerCase().includes(value.toLowerCase())
    ) {
      opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    }
  }
  return false;
}

export function selectOption(fieldId: string, value: string): ToolResult {
  const schema = scanPage();
  const field = schema.fields.find((f) => f.field_id === fieldId);

  if (!field) {
    return { ok: false, field_id: fieldId, error: `Field not found: ${fieldId}` };
  }

  const el = document.querySelector(field.selector);
  if (!el) {
    return { ok: false, field_id: fieldId, error: `Element not found for selector: ${field.selector}` };
  }

  // Google Forms radio group
  if (field.type === 'radio' && el.getAttribute('role') === 'radiogroup') {
    const options = field.options ?? [];
    const match = fuzzyMatch(value, options);
    if (!match) {
      return { ok: false, field_id: fieldId, error: `No matching option found for: ${value}` };
    }
    const success = setGoogleFormsRadio(el, match.value);
    if (!success) {
      return { ok: false, field_id: fieldId, error: `Failed to select option: ${match.value}` };
    }
    return { ok: true, field_id: fieldId, applied_value: match.value };
  }

  // Google Forms listbox
  if (field.type === 'select-one' && el.getAttribute('role') === 'listbox') {
    const options = field.options ?? [];
    const match = fuzzyMatch(value, options);
    if (!match) {
      return { ok: false, field_id: fieldId, error: `No matching option found for: ${value}` };
    }
    const success = setGoogleFormsListbox(el, match.value);
    if (!success) {
      return { ok: false, field_id: fieldId, error: `Failed to select option: ${match.value}` };
    }
    return { ok: true, field_id: fieldId, applied_value: match.value };
  }

  // Standard select element
  if (field.type !== 'select-one' && field.type !== 'select-multiple') {
    return { ok: false, field_id: fieldId, error: `Field is not a select element` };
  }

  if (!(el instanceof HTMLSelectElement)) {
    return { ok: false, field_id: fieldId, error: `Element is not a select element` };
  }

  const options = field.options ?? [];
  const match = fuzzyMatch(value, options);

  if (!match) {
    return { ok: false, field_id: fieldId, error: `No matching option found for: ${value}` };
  }

  el.value = match.value;
  el.dispatchEvent(new Event('change', { bubbles: true }));

  return { ok: true, field_id: fieldId, applied_value: match.value };
}
