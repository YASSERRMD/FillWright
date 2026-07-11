import type { FormField } from '../types';
import { generateSelector, generateFieldId } from './selector';
import { getLabelText, getNearbyText } from './label';
import { isHidden, isInInactiveWizardStep } from './hidden';

export function getFieldOptions(el: Element): { value: string; label: string }[] | null {
  if (el instanceof HTMLSelectElement) {
    return Array.from(el.options).map((opt) => ({
      value: opt.value,
      label: opt.textContent?.trim() ?? '',
    }));
  }

  if (el instanceof HTMLInputElement && el.type === 'radio') {
    const name = el.name;
    if (!name) return null;

    const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
    return Array.from(radios).map((radio) => ({
      value: (radio as HTMLInputElement).value,
      label: getLabelText(radio) ?? (radio as HTMLInputElement).value,
    }));
  }

  return null;
}

export function extractField(el: Element): FormField | null {
  const isInput = el instanceof HTMLInputElement;
  const isTextarea = el instanceof HTMLTextAreaElement;
  const isSelect = el instanceof HTMLSelectElement;
  const isContentEditable = el.getAttribute('contenteditable') === 'true';

  if (!isInput && !isTextarea && !isSelect && !isContentEditable) {
    return null;
  }

  if (isInput && el.type === 'radio') {
    const name = el.name;
    if (name) {
      const firstRadio = document.querySelector(
        `input[type="radio"][name="${name}"]`
      );
      if (firstRadio !== el) return null;
    }
  }

  const hidden = isHidden(el);
  const inInactiveStep = isInInactiveWizardStep(el);

  if (hidden && !inInactiveStep) {
    return null;
  }

  const selector = generateSelector(el);
  const label = getLabelText(el);
  const name = isInput || isTextarea || isSelect ? el.getAttribute('name') : null;
  const fieldId = generateFieldId(selector, label ?? '', name ?? '');

  let currentValue = '';
  if (isInput || isTextarea || isSelect) {
    currentValue = el.value;
  }

  let fieldType: string;
  if (isSelect) {
    fieldType = (el as HTMLSelectElement).type || 'select';
  } else if (isContentEditable) {
    fieldType = 'contenteditable';
  } else {
    fieldType = el.getAttribute('type') ?? el.tagName.toLowerCase();
  }

  const field: FormField = {
    field_id: fieldId,
    selector,
    type: fieldType,
    name,
    id: el.id || null,
    autocomplete: el.getAttribute('autocomplete'),
    label,
    required: el.hasAttribute('required'),
    pattern: el.getAttribute('pattern'),
    maxlength: el.getAttribute('maxlength') ? parseInt(el.getAttribute('maxlength')!, 10) : null,
    min: el.getAttribute('min') ? parseFloat(el.getAttribute('min')!) : null,
    max: el.getAttribute('max') ? parseFloat(el.getAttribute('max')!) : null,
    step: el.getAttribute('step') ? parseFloat(el.getAttribute('step')!) : null,
    options: getFieldOptions(el),
    currentValue,
    nearbyText: getNearbyText(el),
    hidden,
  };

  if (inInactiveStep) {
    const step = el.closest('[data-step]');
    field.step_hint = step?.getAttribute('data-step') ?? 'inactive';
  }

  return field;
}
