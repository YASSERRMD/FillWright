import type { FormField, FormSchema, ScanOptions } from '../types';
import { extractField } from './field';
import { estimateTokens } from './tokens';

export { generateSelector, generateFieldId } from './selector';
export { getLabelText, getNearbyText } from './label';
export { isHidden, isInInactiveWizardStep } from './hidden';
export { extractField, getFieldOptions } from './field';
export { estimateTokens } from './tokens';

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
