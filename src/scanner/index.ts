import type { FormField, FormSchema, ScanOptions } from '../types';
import { extractField } from './field';
import { estimateTokens } from './tokens';

export { generateSelector, generateFieldId } from './selector';
export { getLabelText, getNearbyText } from './label';
export { isHidden, isInInactiveWizardStep } from './hidden';
export { extractField, getFieldOptions } from './field';
export { estimateTokens } from './tokens';

function getAccessibleIframes(): HTMLIFrameElement[] {
  const iframes = document.querySelectorAll('iframe');
  const accessible: HTMLIFrameElement[] = [];
  for (const iframe of Array.from(iframes)) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        accessible.push(iframe);
      }
    } catch {
      // Cross-origin iframe, skip
    }
  }
  return accessible;
}

function scanGoogleFormsFields(doc: Document): FormField[] {
  const fields: FormField[] = [];

  // Google Forms text inputs: div[role="textbox"] or input inside [data-params]
  const textboxes = doc.querySelectorAll('div[role="textbox"], input[type="text"], textarea');
  for (const el of Array.from(textboxes)) {
    const field = extractField(el);
    if (field) fields.push(field);
  }

  // Google Forms radio buttons: div[role="radio"] inside div[role="radiogroup"]
  const radioGroups = doc.querySelectorAll('div[role="radiogroup"]');
  for (const group of Array.from(radioGroups)) {
    const radios = group.querySelectorAll('div[role="radio"]');
    if (radios.length === 0) continue;

    const firstRadio = radios[0]!;
    const label = firstRadio.closest('[data-params]')?.querySelector('[role="heading"]')?.textContent?.trim()
      ?? firstRadio.getAttribute('aria-label')
      ?? null;

    const selector = `div[role="radiogroup"]`;
    const options = Array.from(radios).map((r) => ({
      value: r.getAttribute('data-value') ?? r.textContent?.trim() ?? '',
      label: r.getAttribute('aria-label') ?? r.textContent?.trim() ?? '',
    }));

    fields.push({
      field_id: `gforms_radio_${fields.length}`,
      selector,
      type: 'radio',
      name: null,
      id: null,
      autocomplete: null,
      label,
      required: false,
      pattern: null,
      maxlength: null,
      min: null,
      max: null,
      step: null,
      options,
      currentValue: firstRadio!.getAttribute('aria-checked') === 'true'
        ? (firstRadio!.getAttribute('data-value') ?? '')
        : '',
      nearbyText: label,
      hidden: false,
    });
  }

  // Google Forms dropdowns: div[role="listbox"]
  const listboxes = doc.querySelectorAll('div[role="listbox"]');
  for (const el of Array.from(listboxes)) {
    const label = el.closest('[data-params]')?.querySelector('[role="heading"]')?.textContent?.trim()
      ?? el.getAttribute('aria-label')
      ?? null;

    const options = Array.from(el.querySelectorAll('[role="option"]')).map((opt) => ({
      value: opt.getAttribute('data-value') ?? opt.textContent?.trim() ?? '',
      label: opt.getAttribute('aria-label') ?? opt.textContent?.trim() ?? '',
    }));

    fields.push({
      field_id: `gforms_listbox_${fields.length}`,
      selector: 'div[role="listbox"]',
      type: 'select-one',
      name: null,
      id: null,
      autocomplete: null,
      label,
      required: false,
      pattern: null,
      maxlength: null,
      min: null,
      max: null,
      step: null,
      options,
      currentValue: el.querySelector('[aria-selected="true"]')?.getAttribute('data-value') ?? '',
      nearbyText: label,
      hidden: false,
    });
  }

  return fields;
}

export function scanPage(options?: ScanOptions): FormSchema {
  const opts: ScanOptions = {
    includeHidden: false,
    debounceMs: 300,
    ...options,
  };

  const fields: FormField[] = [];

  // Scan main document
  const fieldElements = document.querySelectorAll(
    'input, textarea, select, [contenteditable="true"]'
  );

  for (const el of Array.from(fieldElements)) {
    const field = extractField(el);
    if (field) {
      if (!opts.includeHidden && field.hidden) continue;
      fields.push(field);
    }
  }

  // Scan Google Forms custom elements in main document
  const gformsFields = scanGoogleFormsFields(document);
  fields.push(...gformsFields);

  // Scan accessible iframes
  const iframes = getAccessibleIframes();
  for (const iframe of iframes) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) continue;

      // Standard form elements inside iframe
      const iframeFields = doc.querySelectorAll(
        'input, textarea, select, [contenteditable="true"]'
      );
      for (const el of Array.from(iframeFields)) {
        const field = extractField(el, iframe);
        if (field) {
          if (!opts.includeHidden && field.hidden) continue;
          fields.push(field);
        }
      }

      // Google Forms elements inside iframe
      const gformsIframeFields = scanGoogleFormsFields(doc);
      fields.push(...gformsIframeFields);
    } catch {
      // Skip inaccessible iframes
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
