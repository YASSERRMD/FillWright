import type { DiffItem, OverlayOptions } from './types';

const OVERLAY_ID = 'fillwright-overlay';

const STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #1a1a1a;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .overlay-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
  }

  .overlay-dialog {
    position: relative;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .overlay-header {
    padding: 16px 20px;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .overlay-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .overlay-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
  }

  .overlay-close:hover {
    background: #f0f0f0;
  }

  .overlay-body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .field-group {
    margin-bottom: 16px;
  }

  .field-group-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: #666;
    margin-bottom: 8px;
  }

  .field-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .field-item.rejected {
    opacity: 0.5;
    background: #f8f8f8;
  }

  .field-checkbox {
    margin-right: 12px;
    width: 18px;
    height: 18px;
  }

  .field-info {
    flex: 1;
  }

  .field-label {
    font-weight: 500;
    margin-bottom: 2px;
  }

  .field-values {
    font-size: 12px;
    color: #666;
  }

  .field-old {
    text-decoration: line-through;
    color: #999;
  }

  .field-new {
    color: #1a73e8;
    font-weight: 500;
  }

  .field-confidence {
    font-size: 11px;
    color: #999;
    margin-left: 8px;
  }

  .overlay-footer {
    padding: 16px 20px;
    border-top: 1px solid #e0e0e0;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid #d0d0d0;
    background: white;
  }

  .btn:hover {
    background: #f8f8f8;
  }

  .btn-primary {
    background: #1a73e8;
    color: white;
    border-color: #1a73e8;
  }

  .btn-primary:hover {
    background: #1557b0;
  }

  .btn-danger {
    background: #d93025;
    color: white;
    border-color: #d93025;
  }

  .btn-danger:hover {
    background: #b3261e;
  }
`;

let activeOverlay: ConfirmationOverlay | null = null;

export class ConfirmationOverlay {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private options: OverlayOptions;
  private items: DiffItem[];
  private focusableElements: HTMLElement[] = [];
  private previousFocus: HTMLElement | null = null;

  constructor(options: OverlayOptions) {
    this.options = options;
    this.items = options.items.map((item) => ({ ...item, accepted: true }));

    this.host = document.createElement('div');
    this.host.id = OVERLAY_ID;
    this.shadow = this.host.attachShadow({ mode: 'open' });

    this.render();
    document.body.appendChild(this.host);
    this.previousFocus = document.activeElement as HTMLElement;
    this.setupFocusTrap();
  }

  private render(): void {
    const style = document.createElement('style');
    style.textContent = STYLES;

    const backdrop = document.createElement('div');
    backdrop.className = 'overlay-backdrop';
    backdrop.addEventListener('click', () => this.cancel());

    const dialog = document.createElement('div');
    dialog.className = 'overlay-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'overlay-title');

    dialog.appendChild(this.renderHeader());
    dialog.appendChild(this.renderBody());
    dialog.appendChild(this.renderFooter());

    this.shadow.appendChild(style);
    this.shadow.appendChild(backdrop);
    this.shadow.appendChild(dialog);

    this.focusableElements = Array.from(
      this.shadow.querySelectorAll('button, [tabindex]:not([tabindex="-1"])')
    ) as HTMLElement[];
  }

  private renderHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.className = 'overlay-header';

    const title = document.createElement('h2');
    title.id = 'overlay-title';
    title.textContent =
      this.options.mode === 'review-before-fill'
        ? 'Review Fill Plan'
        : 'Review Before Submit';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', () => this.cancel());

    header.appendChild(title);
    header.appendChild(closeBtn);
    return header;
  }

  private renderBody(): HTMLDivElement {
    const body = document.createElement('div');
    body.className = 'overlay-body';

    const grouped = this.groupByStep();

    for (const [step, items] of grouped) {
      const group = document.createElement('div');
      group.className = 'field-group';

      if (step !== '__main__') {
        const groupTitle = document.createElement('div');
        groupTitle.className = 'field-group-title';
        groupTitle.textContent = `Step ${step}`;
        group.appendChild(groupTitle);
      }

      for (const item of items) {
        group.appendChild(this.renderFieldItem(item));
      }

      body.appendChild(group);
    }

    return body;
  }

  private renderFieldItem(item: DiffItem): HTMLDivElement {
    const el = document.createElement('div');
    el.className = `field-item ${item.accepted ? '' : 'rejected'}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'field-checkbox';
    checkbox.checked = item.accepted;
    checkbox.setAttribute('aria-label', `Accept change for ${item.label}`);
    checkbox.addEventListener('change', () => {
      item.accepted = checkbox.checked;
      el.className = `field-item ${item.accepted ? '' : 'rejected'}`;
    });

    const info = document.createElement('div');
    info.className = 'field-info';

    const label = document.createElement('div');
    label.className = 'field-label';
    label.textContent = item.label;

    const values = document.createElement('div');
    values.className = 'field-values';

    if (item.oldValue) {
      const oldSpan = document.createElement('span');
      oldSpan.className = 'field-old';
      oldSpan.textContent = item.oldValue;
      values.appendChild(oldSpan);
      values.appendChild(document.createTextNode(' -> '));
    }

    const newSpan = document.createElement('span');
    newSpan.className = 'field-new';
    newSpan.textContent = item.newValue;
    values.appendChild(newSpan);

    const confidence = document.createElement('span');
    confidence.className = 'field-confidence';
    confidence.textContent = `${Math.round(item.confidence * 100)}%`;

    info.appendChild(label);
    info.appendChild(values);
    info.appendChild(confidence);

    el.appendChild(checkbox);
    el.appendChild(info);
    return el;
  }

  private renderFooter(): HTMLDivElement {
    const footer = document.createElement('div');
    footer.className = 'overlay-footer';

    const rejectAllBtn = document.createElement('button');
    rejectAllBtn.className = 'btn btn-danger';
    rejectAllBtn.textContent = 'Reject All';
    rejectAllBtn.addEventListener('click', () => this.rejectAll());

    const acceptAllBtn = document.createElement('button');
    acceptAllBtn.className = 'btn';
    acceptAllBtn.textContent = 'Accept All';
    acceptAllBtn.addEventListener('click', () => this.acceptAll());

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.addEventListener('click', () => this.confirm());

    footer.appendChild(rejectAllBtn);
    footer.appendChild(acceptAllBtn);
    footer.appendChild(confirmBtn);
    return footer;
  }

  private groupByStep(): Map<string, DiffItem[]> {
    const groups = new Map<string, DiffItem[]>();
    for (const item of this.items) {
      const step = item.step ?? '__main__';
      const group = groups.get(step) ?? [];
      group.push(item);
      groups.set(step, group);
    }
    return groups;
  }

  private acceptAll(): void {
    this.items.forEach((item) => { item.accepted = true; });
    this.refreshCheckboxes(true);
  }

  private rejectAll(): void {
    this.items.forEach((item) => { item.accepted = false; });
    this.refreshCheckboxes(false);
  }

  private refreshCheckboxes(checked: boolean): void {
    const checkboxes = this.shadow.querySelectorAll('.field-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((cb) => {
      cb.checked = checked;
      cb.closest('.field-item')?.classList.toggle('rejected', !checked);
    });
  }

  private confirm(): void {
    const accepted = this.items.filter((item) => item.accepted);
    this.options.onConfirm(accepted);
    this.destroy();
  }

  private cancel(): void {
    this.options.onCancel();
    this.destroy();
  }

  private setupFocusTrap(): void {
    this.shadow.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Escape') {
        this.cancel();
        return;
      }

      if (ke.key === 'Tab') {
        const first = this.focusableElements[0];
        const last = this.focusableElements[this.focusableElements.length - 1];

        if (ke.shiftKey) {
          if (this.shadow.activeElement === first) {
            ke.preventDefault();
            last?.focus();
          }
        } else {
          if (this.shadow.activeElement === last) {
            ke.preventDefault();
            first?.focus();
          }
        }
      }
    });

    if (this.focusableElements.length > 0) {
      this.focusableElements[0]?.focus();
    }
  }

  destroy(): void {
    if (this.previousFocus) {
      this.previousFocus.focus();
    }
    this.host.remove();
    if (activeOverlay === this) {
      activeOverlay = null;
    }
  }
}

export function showConfirmation(options: OverlayOptions): ConfirmationOverlay {
  if (activeOverlay) {
    activeOverlay.destroy();
  }
  activeOverlay = new ConfirmationOverlay(options);
  return activeOverlay;
}

export function removeOverlay(): void {
  if (activeOverlay) {
    activeOverlay.destroy();
  }
}
