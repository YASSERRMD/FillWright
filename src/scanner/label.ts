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

  return texts.join(' ').trim() || null;
}
