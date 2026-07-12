const PROFILE_OVERLAY_ID = 'fillwright-profile-overlay';

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
    max-width: 640px;
    width: 92%;
    max-height: 85vh;
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
    color: #1B2A4A;
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

  .help-text {
    font-size: 13px;
    color: #666;
    margin-bottom: 12px;
  }

  .help-text code {
    background: #f2f2f2;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }

  .json-textarea {
    width: 100%;
    min-height: 320px;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    padding: 12px;
    border: 1px solid #d0d0d0;
    border-radius: 8px;
    resize: vertical;
    background: #fafafa;
    color: #1a1a1a;
    tab-size: 2;
  }

  .json-textarea:focus {
    outline: none;
    border-color: #C5A55A;
    box-shadow: 0 0 0 3px rgba(197, 165, 90, 0.2);
  }

  .error-message {
    color: #d93025;
    font-size: 12px;
    margin-top: 8px;
    display: none;
  }

  .error-message.visible {
    display: block;
  }

  .success-message {
    color: #1B2A4A;
    font-size: 12px;
    margin-top: 8px;
    display: none;
    font-weight: 500;
  }

  .success-message.visible {
    display: block;
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
    background: #1B2A4A;
    color: white;
    border-color: #1B2A4A;
  }

  .btn-primary:hover {
    background: #0F1B33;
  }

  .btn-gold {
    background: #C5A55A;
    color: #1B2A4A;
    border-color: #C5A55A;
    font-weight: 600;
  }

  .btn-gold:hover {
    background: #b89a4e;
  }

  .current-profile {
    margin-bottom: 16px;
  }

  .current-profile summary {
    cursor: pointer;
    font-size: 13px;
    color: #666;
    font-weight: 500;
  }

  .current-profile pre {
    background: #f2f2f2;
    padding: 10px;
    border-radius: 6px;
    font-size: 11px;
    overflow-x: auto;
    margin-top: 8px;
    max-height: 120px;
    overflow-y: auto;
  }
`;

let activeProfileOverlay: ProfileImportOverlay | null = null;

export interface ProfileImportOptions {
  currentProfile: Record<string, string>;
  onImport: (profile: Record<string, string>) => void;
  onCancel: () => void;
}

export class ProfileImportOverlay {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private options: ProfileImportOptions;
  private textarea!: HTMLTextAreaElement;
  private errorMsg!: HTMLDivElement;
  private successMsg!: HTMLDivElement;
  private previousFocus: HTMLElement | null = null;

  constructor(options: ProfileImportOptions) {
    this.options = options;

    this.host = document.createElement('div');
    this.host.id = PROFILE_OVERLAY_ID;
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
    dialog.setAttribute('aria-labelledby', 'profile-overlay-title');

    dialog.appendChild(this.renderHeader());
    dialog.appendChild(this.renderBody());
    dialog.appendChild(this.renderFooter());

    this.shadow.appendChild(style);
    this.shadow.appendChild(backdrop);
    this.shadow.appendChild(dialog);
  }

  private renderHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.className = 'overlay-header';

    const title = document.createElement('h2');
    title.id = 'profile-overlay-title';
    title.textContent = 'Import Profile';

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

    // Current profile display
    if (Object.keys(this.options.currentProfile).length > 0) {
      const currentDiv = document.createElement('details');
      currentDiv.className = 'current-profile';

      const summary = document.createElement('summary');
      summary.textContent = 'Current profile values';
      currentDiv.appendChild(summary);

      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(this.options.currentProfile, null, 2);
      currentDiv.appendChild(pre);

      body.appendChild(currentDiv);
    }

    const help = document.createElement('div');
    help.className = 'help-text';
    help.innerHTML = 'Paste your profile JSON below. Copy the template from <code>docs/profile-template.json</code> or export your current profile, edit it, then paste it back.';
    body.appendChild(help);

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'json-textarea';
    this.textarea.placeholder = '{\n  "identity": {\n    "givenName": "Your Name"\n  }\n}';
    this.textarea.value = JSON.stringify(this.options.currentProfile, null, 2);
    this.textarea.setAttribute('aria-label', 'Profile JSON');
    body.appendChild(this.textarea);

    this.errorMsg = document.createElement('div');
    this.errorMsg.className = 'error-message';
    body.appendChild(this.errorMsg);

    this.successMsg = document.createElement('div');
    this.successMsg.className = 'success-message';
    body.appendChild(this.successMsg);

    return body;
  }

  private renderFooter(): HTMLDivElement {
    const footer = document.createElement('div');
    footer.className = 'overlay-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.cancel());

    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn';
    exportBtn.textContent = 'Export';
    exportBtn.title = 'Copy current profile JSON to clipboard';
    exportBtn.addEventListener('click', () => this.exportProfile());

    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-gold';
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', () => this.importProfile());

    footer.appendChild(cancelBtn);
    footer.appendChild(exportBtn);
    footer.appendChild(importBtn);
    return footer;
  }

  private importProfile(): void {
    this.errorMsg.className = 'error-message';
    this.successMsg.className = 'success-message';

    const raw = this.textarea.value.trim();
    if (!raw) {
      this.errorMsg.textContent = 'Profile JSON is empty.';
      this.errorMsg.className = 'error-message visible';
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const flat: Record<string, string> = {};

      const flatten = (obj: Record<string, unknown>, prefix: string): void => {
        for (const [key, val] of Object.entries(obj)) {
          const path = prefix ? `${prefix}.${key}` : key;
          if (typeof val === 'string') {
            flat[path] = val;
          } else if (Array.isArray(val)) {
            val.forEach((item, i) => {
              if (typeof item === 'string') {
                flat[`${path}.${i}`] = item;
              }
            });
          } else if (typeof val === 'object' && val !== null) {
            flatten(val as Record<string, unknown>, path);
          }
        }
      };

      flatten(parsed, '');

      const count = Object.keys(flat).length;
      if (count === 0) {
        this.errorMsg.textContent = 'No valid fields found in JSON. Expected nested objects with string values.';
        this.errorMsg.className = 'error-message visible';
        return;
      }

      this.successMsg.textContent = `Imported ${count} fields successfully.`;
      this.successMsg.className = 'success-message visible';

      this.options.onImport(flat);
    } catch (e) {
      this.errorMsg.textContent = `Invalid JSON: ${(e as Error).message}`;
      this.errorMsg.className = 'error-message visible';
    }
  }

  private exportProfile(): void {
    const json = JSON.stringify(this.options.currentProfile, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      this.successMsg.textContent = 'Profile JSON copied to clipboard.';
      this.successMsg.className = 'success-message visible';
      this.errorMsg.className = 'error-message';
    }).catch(() => {
      this.textarea.value = json;
      this.textarea.select();
    });
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
        const focusable = Array.from(
          this.shadow.querySelectorAll('button, textarea, [tabindex]:not([tabindex="-1"])')
        ) as HTMLElement[];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

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

    setTimeout(() => this.textarea?.focus(), 50);
  }

  destroy(): void {
    if (this.previousFocus) {
      this.previousFocus.focus();
    }
    this.host.remove();
    if (activeProfileOverlay === this) {
      activeProfileOverlay = null;
    }
  }
}

export function showProfileImport(options: ProfileImportOptions): ProfileImportOverlay {
  if (activeProfileOverlay) {
    activeProfileOverlay.destroy();
  }
  activeProfileOverlay = new ProfileImportOverlay(options);
  return activeProfileOverlay;
}
