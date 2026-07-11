export function isHidden(el: Element): boolean {
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

export function isInInactiveWizardStep(el: Element): boolean {
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
