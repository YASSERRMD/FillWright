import type { ValidationState } from '../types';
import { scanPage } from '../../scanner/index';

export function readValidationErrors(): { ok: boolean; errors: ValidationState[] } {
  const schema = scanPage();
  const errors: ValidationState[] = [];

  for (const field of schema.fields) {
    const el = document.querySelector(field.selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!el) continue;

    let valid = true;
    let validationMessage = '';

    if ('validity' in el) {
      valid = el.validity.valid;
      validationMessage = el.validationMessage;
    }

    const ariaInvalid = el.getAttribute('aria-invalid') === 'true';
    let errorText: string | null = null;

    const errorId = el.getAttribute('aria-describedby');
    if (errorId) {
      const errorEl = document.getElementById(errorId);
      if (errorEl) {
        errorText = errorEl.textContent?.trim() ?? null;
      }
    }

    if (!valid || ariaInvalid || errorText) {
      errors.push({
        field_id: field.field_id,
        valid,
        validationMessage,
        ariaInvalid,
        errorText,
      });
    }
  }

  return { ok: true, errors };
}
