const SELECTOR_CACHE = new Map<string, string>();

export function generateSelector(el: Element): string {
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

export function generateFieldId(selector: string, label: string, name: string): string {
  const input = `${selector}::${label}::${name}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `field_${Math.abs(hash).toString(36)}`;
}
