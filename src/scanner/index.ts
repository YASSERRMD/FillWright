import type { FormField, FormSchema, ScanOptions, TokenEstimate } from '../types';

const SELECTOR_CACHE = new Map<string, string>();

function generateSelector(el: Element): string {
  if (el.id) {
    return `#${el.id}`;
  }

  const cached = SELECTOR_CACHE.get(el.outerHTML);
  if (cached) return cached;

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${current.id}`;
      parts.unshift(selector);
      break;
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  const fullSelector = parts.join(' > ');
  SELECTOR_CACHE.set(el.outerHTML, fullSelector);
  return fullSelector;
}

function generateFieldId(selector: string, label: string, name: string): string {
  const input = `${selector}::${label}::${name}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `field_${Math.abs(hash).toString(36)}`;
}

function getLabelText(el: Element): string | null {
  const inputEl = el as HTMLInputElement;
  const id = inputEl.id;

  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label.textContent?.trim() ?? null;
  }

  const parentLabel = el.closest('label');
  if (parentLabel) return parentLabel.textContent?.trim() ?? null;

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelEl = document.getElementById(ariaLabelledBy);
    if (labelEl) return labelEl.textContent?.trim() ?? null;
  }

  const placeholder = el.getAttribute('placeholder');
  if (placeholder) return placeholder;

  return null;
}

function getNearbyText(el: Element): string | null {
  const parent = el.parentElement;
  if (!parent) return null;

  const siblings = Array.from(parent.childNodes);
  const texts: string[] = [];

  for (const sibling of siblings) {
    if (sibling === el) continue;
    if (sibling.nodeType === Node.TEXT_NODE) {
      const text = sibling.textContent?.trim();
      if (text && text.length > 0 && text.length < 100) {
        texts.push(text);
      }
    } else if (sibling.nodeType === Node.ELEMENT_NODE) {
      const text = (sibling as Element).textContent?.trim();
      if (text && text.length > 0 && text.length < 100) {
        texts.push(text);
      }
    }
  }

  return texts.join(' ').trim() || null;
}

function isHidden(el: Element): boolean {
  if (el.getAttribute('hidden') !== null) return true;
  if (el.getAttribute('aria-hidden') === 'true') return true;

  const htmlEl = el as HTMLElement;
  if (htmlEl.style.display === 'none') return true;
  if (htmlEl.style.visibility === 'hidden') return true;

  const inlineStyle = el.getAttribute('style') ?? '';
  if (/\bdisplay\s*:\s*none/i.test(inlineStyle)) return true;
  if (/\bvisibility\s*:\s*hidden/i.test(inlineStyle)) return true;

  try {
    const computed = window.getComputedStyle(el);
    if (computed.display === 'none') return true;
    if (computed.visibility === 'hidden') return true;
  } catch {
    // getComputedStyle not available
  }

  return false;
}

function isInInactiveWizardStep(el: Element): boolean {
  let current: Element | null = el;
  while (current && current !== document.body) {
    if (
      current.classList.contains('step') ||
      current.getAttribute('data-step') !== null
    ) {
      const isActive =
        current.classList.contains('active') ||
        current.classList.contains('current') ||
        current.getAttribute('aria-current') === 'step';
      return !isActive;
    }
    current = current.parentElement;
  }
  return false;
}

function getFieldOptions(el: Element): { value: string; label: string }[] | null {
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

function extractField(el: Element): FormField | null {
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

function estimateTokens(fields: FormField[]): TokenEstimate {
  const characters = fields.reduce((sum, f) => {
    let fieldChars = 0;
    fieldChars += f.field_id.length;
    fieldChars += f.selector.length;
    fieldChars += f.type.length;
    fieldChars += (f.name ?? '').length;
    fieldChars += (f.label ?? '').length;
    fieldChars += (f.nearbyText ?? '').length;
    fieldChars += f.currentValue.length;
    if (f.options) {
      fieldChars += f.options.reduce((optSum, opt) => optSum + opt.value.length + opt.label.length, 0);
    }
    return sum + fieldChars;
  }, 0);

  return {
    fields: fields.length,
    characters,
    estimatedTokens: Math.ceil(characters / 4),
  };
}

export function scanPage(options?: ScanOptions): FormSchema {
  const opts: ScanOptions = {
    includeHidden: false,
    debounceMs: 300,
    ...options,
  };

  const fieldElements = document.querySelectorAll(
    'input, textarea, select, [contenteditable="true"]'
  );

  const fields: FormField[] = [];

  for (const el of Array.from(fieldElements)) {
    const field = extractField(el);
    if (field) {
      if (!opts.includeHidden && field.hidden) {
        continue;
      }
      fields.push(field);
    }
  }

  const tokenEstimate = estimateTokens(fields);

  return {
    url: window.location.href,
    title: document.title,
    fields,
    timestamp: Date.now(),
    tokenEstimate: tokenEstimate.estimatedTokens,
  };
}

export function observeChanges(
  callback: (schema: FormSchema) => void,
  debounceMs?: number
): () => void {
  const ms = debounceMs ?? 300;
  let timeoutId: ReturnType<typeof setTimeout>;

  const observer = new MutationObserver(() => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(scanPage());
    }, ms);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  return () => observer.disconnect();
}
