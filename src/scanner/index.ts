import type { FormSchema, ScanOptions } from '../types';

export function scanPage(_options?: ScanOptions): FormSchema {
  return {
    url: window.location.href,
    title: document.title,
    fields: [],
    timestamp: Date.now(),
    tokenEstimate: 0,
  };
}

export function observeChanges(callback: (schema: FormSchema) => void, debounceMs?: number): () => void {
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
