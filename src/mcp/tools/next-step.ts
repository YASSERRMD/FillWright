import type { ToolResult } from '../types';

export function nextStep(): ToolResult {
  const nextButtons = document.querySelectorAll(
    'button[type="button"], button:not([type]), input[type="button"], a[role="button"]'
  );

  for (const btn of Array.from(nextButtons)) {
    const text = (btn.textContent ?? '').toLowerCase().trim();
    if (
      text.includes('next') ||
      text.includes('continue') ||
      text.includes('proceed') ||
      text.includes('forward')
    ) {
      (btn as HTMLElement).click();
      return { ok: true };
    }
  }

  const allButtons = document.querySelectorAll('button');
  for (const btn of Array.from(allButtons)) {
    const ariaLabel = (btn.getAttribute('aria-label') ?? '').toLowerCase();
    if (
      ariaLabel.includes('next') ||
      ariaLabel.includes('continue') ||
      ariaLabel.includes('proceed')
    ) {
      (btn as HTMLElement).click();
      return { ok: true };
    }
  }

  return { ok: false, error: 'No next step button found' };
}
