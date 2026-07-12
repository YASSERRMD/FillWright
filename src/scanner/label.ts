export function getLabelText(el: Element): string | null {
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

  // Google Forms: walk up to find role="heading" label
  let parent: Element | null = el.parentElement;
  let depth = 0;
  while (parent && depth < 10) {
    const heading = parent.querySelector('[role="heading"]');
    if (heading) {
      const text = heading.textContent?.trim();
      if (text && text.length > 0 && text.length < 200) return text;
    }

    // Also check for data-params which Google Forms uses
    const dataParams = parent.getAttribute('data-params');
    if (dataParams) {
      try {
        const params = JSON.parse(dataParams);
        if (params && typeof params === 'object') {
          // Google Forms stores label in the params
          const keys = Object.keys(params);
          for (const key of keys) {
            const val = params[key];
            if (typeof val === 'string' && val.length > 0 && val.length < 200) {
              return val;
            }
          }
        }
      } catch {
        // Not JSON, skip
      }
    }

    // Check aria-label on parent
    const parentAriaLabel = parent.getAttribute('aria-label');
    if (parentAriaLabel) return parentAriaLabel;

    parent = parent.parentElement;
    depth++;
  }

  return null;
}

export function getNearbyText(el: Element): string | null {
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

  // Also check nearby siblings of parent
  if (texts.length === 0 && parent.parentElement) {
    const grandparent = parent.parentElement;
    const parentSiblings = Array.from(grandparent.children);
    const parentIndex = parentSiblings.indexOf(parent);

    for (let i = Math.max(0, parentIndex - 1); i <= Math.min(parentSiblings.length - 1, parentIndex + 1); i++) {
      const sibling = parentSiblings[i] as Element | undefined;
      if (!sibling || sibling === parent) continue;
      const text = sibling.textContent?.trim();
      if (text && text.length > 0 && text.length < 100) {
        texts.push(text);
      }
    }
  }

  return texts.join(' ').trim() || null;
}
