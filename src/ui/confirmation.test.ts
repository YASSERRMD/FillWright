import { describe, it, expect, beforeEach } from 'vitest';
import { ConfirmationOverlay, showConfirmation, removeOverlay } from './confirmation';
import type { DiffItem } from '../types';

function createTestItems(): DiffItem[] {
  return [
    { field_id: 'f1', label: 'First Name', oldValue: '', newValue: 'Alice', confidence: 0.9, accepted: true },
    { field_id: 'f2', label: 'Email', oldValue: '', newValue: 'alice@test.com', confidence: 0.85, accepted: true },
  ];
}

describe('ConfirmationOverlay', () => {
  beforeEach(() => {
    removeOverlay();
    document.body.innerHTML = '';
  });

  it('should create overlay with items', () => {
    const overlay = new ConfirmationOverlay({
      mode: 'review-before-fill',
      items: createTestItems(),
      onConfirm: () => {},
      onCancel: () => {},
    });

    const el = document.getElementById('fillwright-overlay');
    expect(el).not.toBeNull();
    expect(el?.shadowRoot).not.toBeNull();
    overlay.destroy();
  });

  it('should show correct title for review-before-fill mode', () => {
    const overlay = new ConfirmationOverlay({
      mode: 'review-before-fill',
      items: createTestItems(),
      onConfirm: () => {},
      onCancel: () => {},
    });

    const shadow = document.getElementById('fillwright-overlay')?.shadowRoot;
    const title = shadow?.getElementById('overlay-title');
    expect(title?.textContent).toBe('Review Fill Plan');
    overlay.destroy();
  });

  it('should show correct title for review-before-submit mode', () => {
    const overlay = new ConfirmationOverlay({
      mode: 'review-before-submit',
      items: createTestItems(),
      onConfirm: () => {},
      onCancel: () => {},
    });

    const shadow = document.getElementById('fillwright-overlay')?.shadowRoot;
    const title = shadow?.getElementById('overlay-title');
    expect(title?.textContent).toBe('Review Before Submit');
    overlay.destroy();
  });

  it('should call onConfirm with accepted items', () => {
    let acceptedItems: DiffItem[] = [];
    new ConfirmationOverlay({
      mode: 'review-before-fill',
      items: createTestItems(),
      onConfirm: (items) => { acceptedItems = items; },
      onCancel: () => {},
    });

    const shadow = document.getElementById('fillwright-overlay')?.shadowRoot;
    const confirmBtn = shadow?.querySelector('.btn-primary') as HTMLButtonElement;
    confirmBtn.click();

    expect(acceptedItems).toHaveLength(2);
    expect(acceptedItems[0]?.field_id).toBe('f1');
  });

  it('should call onCancel when cancelled', () => {
    let cancelled = false;
    new ConfirmationOverlay({
      mode: 'review-before-fill',
      items: createTestItems(),
      onConfirm: () => {},
      onCancel: () => { cancelled = true; },
    });

    const shadow = document.getElementById('fillwright-overlay')?.shadowRoot;
    const closeBtn = shadow?.querySelector('.overlay-close') as HTMLButtonElement;
    closeBtn.click();

    expect(cancelled).toBe(true);
  });

  it('should set aria attributes on dialog', () => {
    const overlay = new ConfirmationOverlay({
      mode: 'review-before-fill',
      items: createTestItems(),
      onConfirm: () => {},
      onCancel: () => {},
    });

    const shadow = document.getElementById('fillwright-overlay')?.shadowRoot;
    const dialog = shadow?.querySelector('.overlay-dialog');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    overlay.destroy();
  });

  it('should use shadow DOM for style isolation', () => {
    const overlay = new ConfirmationOverlay({
      mode: 'review-before-fill',
      items: createTestItems(),
      onConfirm: () => {},
      onCancel: () => {},
    });

    const host = document.getElementById('fillwright-overlay');
    expect(host?.shadowRoot).not.toBeNull();
    expect(host?.shadowRoot?.mode).toBe('open');
    overlay.destroy();
  });
});

describe('showConfirmation', () => {
  beforeEach(() => {
    removeOverlay();
    document.body.innerHTML = '';
  });

  it('should create and return overlay instance', () => {
    const overlay = showConfirmation({
      mode: 'review-before-fill',
      items: createTestItems(),
      onConfirm: () => {},
      onCancel: () => {},
    });

    expect(overlay).toBeInstanceOf(ConfirmationOverlay);
    overlay.destroy();
  });

  it('should replace existing overlay', () => {
    showConfirmation({
      mode: 'review-before-fill',
      items: createTestItems(),
      onConfirm: () => {},
      onCancel: () => {},
    });

    showConfirmation({
      mode: 'review-before-fill',
      items: createTestItems(),
      onConfirm: () => {},
      onCancel: () => {},
    });

    const overlays = document.querySelectorAll('#fillwright-overlay');
    expect(overlays).toHaveLength(1);
  });
});

describe('removeOverlay', () => {
  beforeEach(() => {
    removeOverlay();
    document.body.innerHTML = '';
  });

  it('should remove active overlay', () => {
    showConfirmation({
      mode: 'review-before-fill',
      items: createTestItems(),
      onConfirm: () => {},
      onCancel: () => {},
    });

    removeOverlay();
    const overlay = document.getElementById('fillwright-overlay');
    expect(overlay).toBeNull();
  });
});
