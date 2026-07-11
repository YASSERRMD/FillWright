export interface OverlayOptions {
  mode: 'review-before-fill' | 'review-before-submit';
  onConfirm: () => void;
  onCancel: () => void;
}

export function createOverlay(_options: OverlayOptions): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = 'fillwright-overlay';
  return overlay;
}

export function removeOverlay(): void {
  const overlay = document.getElementById('fillwright-overlay');
  if (overlay) {
    overlay.remove();
  }
}
