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

function findGoogleFormsLabel(el: Element): string | null {
  // Walk up DOM to find the question container and its heading
  let parent: Element | null = el;
  let depth = 0;
  while (parent && depth < 15) {
    // Google Forms wraps each question in a container with role="listitem" or data-params
    const heading = parent.querySelector('[role="heading"]');
    if (heading) {
      const text = heading.textContent?.trim();
      if (text && text.length > 0 && text.length < 200) return text;
    }

    // Check aria-label on the container
    const ariaLabel = parent.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.length > 2) return ariaLabel;

    // Check for label element
    const labelEl = parent.querySelector('label');
    if (labelEl) {
      const text = labelEl.textContent?.trim();
      if (text && text.length > 0 && text.length < 200) return text;
    }

    parent = parent.parentElement;
    depth++;
  }
  return null;
}

function generateUniqueSelector(el: Element, doc: Document, index: number): string {
  // For Google Forms elements, use a combination of role and position
  const role = el.getAttribute('role');
  if (role) {
    const allWithRole = doc.querySelectorAll(`[role="${role}"]`);
    const pos = Array.from(allWithRole).indexOf(el);
    return `[role="${role}"]:nth-of-type(${pos + 1})`;
  }

  // Fallback: use tag + position
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
    const pos = siblings.indexOf(el);
    return `${tag}:nth-of-type(${pos + 1})`;
  }

  return tag;
}

function scanGoogleFormsFields(doc: Document): FormField[] {
  const fields: FormField[] = [];

  // Google Forms text inputs: role="textbox" without contenteditable
  const textboxes = doc.querySelectorAll('div[role="textbox"]:not([contenteditable])');
  for (const el of Array.from(textboxes)) {
    const label = findGoogleFormsLabel(el);
    const selector = generateUniqueSelector(el, doc, fields.length);
    fields.push({
      field_id: `gforms_text_${fields.length}`,
      selector,
      type: 'text',
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
      options: null,
      currentValue: el.textContent?.trim() ?? '',
      nearbyText: label,
      hidden: false,
    });
  }

  // Google Forms radio buttons: div[role="radiogroup"]
  const radioGroups = doc.querySelectorAll('div[role="radiogroup"]');
  for (const group of Array.from(radioGroups)) {
    const radios = group.querySelectorAll('div[role="radio"]');
    if (radios.length === 0) continue;

    const label = findGoogleFormsLabel(group);
    const selector = generateUniqueSelector(group, doc, fields.length);

    const options = Array.from(radios).map((r) => ({
      value: r.getAttribute('data-value') ?? r.textContent?.trim() ?? '',
      label: r.getAttribute('aria-label') ?? r.textContent?.trim() ?? '',
    }));

    const checkedRadio = group.querySelector('[aria-checked="true"]');

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
      currentValue: checkedRadio?.getAttribute('data-value') ?? checkedRadio?.textContent?.trim() ?? '',
      nearbyText: label,
      hidden: false,
    });
  }

  // Google Forms dropdowns: div[role="listbox"]
  const listboxes = doc.querySelectorAll('div[role="listbox"]');
  for (const el of Array.from(listboxes)) {
    const label = findGoogleFormsLabel(el);
    const selector = generateUniqueSelector(el, doc, fields.length);

    const options = Array.from(el.querySelectorAll('[role="option"]')).map((opt) => ({
      value: opt.getAttribute('data-value') ?? opt.textContent?.trim() ?? '',
      label: opt.getAttribute('aria-label') ?? opt.textContent?.trim() ?? '',
    }));

    const selected = el.querySelector('[aria-selected="true"]');

    fields.push({
      field_id: `gforms_listbox_${fields.length}`,
      selector,
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
      currentValue: selected?.getAttribute('data-value') ?? selected?.textContent?.trim() ?? '',
      nearbyText: label,
      hidden: false,
    });
  }

  // Google Forms checkboxes: div[role="checkbox"]
  const checkboxes = doc.querySelectorAll('div[role="checkbox"]');
  for (const el of Array.from(checkboxes)) {
    const label = findGoogleFormsLabel(el);
    const selector = generateUniqueSelector(el, doc, fields.length);

    fields.push({
      field_id: `gforms_checkbox_${fields.length}`,
      selector,
      type: 'checkbox',
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
      options: null,
      currentValue: el.getAttribute('aria-checked') === 'true' ? 'true' : 'false',
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

  // Scan main document - standard form elements
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
