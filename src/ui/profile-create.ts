import { parseProfileText, getExtractedSummary } from '../nano/text-parser';
import type { Profile } from '../types/profile';

const PROFILE_CREATE_ID = 'fillwright-profile-create';

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
    width: 92%;
    max-height: 88vh;
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

  .profile-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }

  .profile-name-row label {
    font-weight: 600;
    font-size: 13px;
    color: #1B2A4A;
    white-space: nowrap;
  }

  .profile-name-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    font-size: 14px;
  }

  .profile-name-input:focus {
    outline: none;
    border-color: #C5A55A;
    box-shadow: 0 0 0 3px rgba(197, 165, 90, 0.2);
  }

  .hint-text {
    font-size: 13px;
    color: #666;
    margin-bottom: 10px;
    line-height: 1.6;
  }

  .hint-text strong {
    color: #1B2A4A;
  }

  .hint-examples {
    font-size: 12px;
    color: #888;
    background: #f8f8f8;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 14px;
    border-left: 3px solid #C5A55A;
    white-space: pre-line;
  }

  .profile-textarea {
    width: 100%;
    min-height: 140px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    padding: 12px;
    border: 1px solid #d0d0d0;
    border-radius: 8px;
    resize: vertical;
    background: #fafafa;
    color: #1a1a1a;
  }

  .profile-textarea:focus {
    outline: none;
    border-color: #C5A55A;
    box-shadow: 0 0 0 3px rgba(197, 165, 90, 0.2);
  }

  .profile-textarea::placeholder {
    color: #aaa;
  }

  .extracted-preview {
    margin-top: 14px;
    background: #f2f2f2;
    border-radius: 8px;
    padding: 12px;
    display: none;
  }

  .extracted-preview.visible {
    display: block;
  }

  .extracted-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: #1B2A4A;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
  }

  .extracted-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .extracted-list li {
    font-size: 13px;
    padding: 3px 0;
    color: #333;
    border-bottom: 1px solid #e8e8e8;
  }

  .extracted-list li:last-child {
    border-bottom: none;
  }

  .extracted-list .field-value {
    color: #C5A55A;
    font-weight: 500;
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
`;

export interface ProfileCreateOptions {
  existingNames: string[];
  onSave: (name: string, profile: Profile) => void;
  onCancel: () => void;
}

let activeCreateOverlay: ProfileCreateOverlay | null = null;

export class ProfileCreateOverlay {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private options: ProfileCreateOptions;
  private nameInput!: HTMLInputElement;
  private textarea!: HTMLTextAreaElement;
  private previewDiv!: HTMLDivElement;
  private extractedList!: HTMLUListElement;
  private errorMsg!: HTMLDivElement;
  private parsedProfile: Profile | null = null;
  private previousFocus: HTMLElement | null = null;

  constructor(options: ProfileCreateOptions) {
    this.options = options;
    this.host = document.createElement('div');
    this.host.id = PROFILE_CREATE_ID;
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
    dialog.setAttribute('aria-labelledby', 'create-title');

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
    title.id = 'create-title';
    title.textContent = 'Create Profile';

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

    // Profile name
    const nameRow = document.createElement('div');
    nameRow.className = 'profile-name-row';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Profile name:';
    this.nameInput = document.createElement('input');
    this.nameInput.className = 'profile-name-input';
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'e.g. Personal, Work, Partner';
    this.nameInput.value = this.suggestName();
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(this.nameInput);
    body.appendChild(nameRow);

    // Hint text
    const hint = document.createElement('div');
    hint.className = 'hint-text';
    hint.innerHTML = '<strong>Describe yourself in a paragraph.</strong> Fillwright will extract your name, email, phone, address, work info, and documents automatically.';
    body.appendChild(hint);

    // Examples
    const examples = document.createElement('div');
    examples.className = 'hint-examples';
    examples.textContent =
      'Example: "I am Alice Johnson, a Software Engineer at Acme Corp. My email is alice@acme.com and phone is +1-555-0123. I live at 123 Main Street, Springfield. My passport is AB1234567."';
    body.appendChild(examples);

    // Textarea
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'profile-textarea';
    this.textarea.placeholder = 'Write about yourself here...';
    this.textarea.addEventListener('input', () => this.onTextChange());
    body.appendChild(this.textarea);

    // Extracted preview
    this.previewDiv = document.createElement('div');
    this.previewDiv.className = 'extracted-preview';
    const previewTitle = document.createElement('div');
    previewTitle.className = 'extracted-title';
    previewTitle.textContent = 'Detected fields';
    this.previewDiv.appendChild(previewTitle);

    this.extractedList = document.createElement('ul');
    this.extractedList.className = 'extracted-list';
    this.previewDiv.appendChild(this.extractedList);
    body.appendChild(this.previewDiv);

    // Error
    this.errorMsg = document.createElement('div');
    this.errorMsg.className = 'error-message';
    body.appendChild(this.errorMsg);

    return body;
  }

  private renderFooter(): HTMLDivElement {
    const footer = document.createElement('div');
    footer.className = 'overlay-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.cancel());

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-gold';
    saveBtn.textContent = 'Save Profile';
    saveBtn.addEventListener('click', () => this.saveProfile());

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    return footer;
  }

  private suggestName(): string {
    const names = this.options.existingNames;
    let n = 1;
    while (names.includes(`Profile ${n}`)) n++;
    return `Profile ${n}`;
  }

  private onTextChange(): void {
    const text = this.textarea.value.trim();
    this.errorMsg.className = 'error-message';

    if (text.length < 10) {
      this.previewDiv.className = 'extracted-preview';
      this.parsedProfile = null;
      return;
    }

    this.parsedProfile = parseProfileText(text);
    const summary = getExtractedSummary(this.parsedProfile);

    this.extractedList.innerHTML = '';
    if (summary.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No fields detected. Try including your name, email, phone, or address.';
      li.style.color = '#999';
      this.extractedList.appendChild(li);
    } else {
      for (const item of summary) {
        const li = document.createElement('li');
        const colonIdx = item.indexOf(':');
        if (colonIdx > 0) {
          const label = document.createElement('span');
          label.textContent = item.slice(0, colonIdx + 1) + ' ';
          const value = document.createElement('span');
          value.className = 'field-value';
          value.textContent = item.slice(colonIdx + 1);
          li.appendChild(label);
          li.appendChild(value);
        } else {
          li.textContent = item;
        }
        this.extractedList.appendChild(li);
      }
    }

    this.previewDiv.className = 'extracted-preview visible';
  }

  private saveProfile(): void {
    this.errorMsg.className = 'error-message';
    const name = this.nameInput.value.trim();

    if (!name) {
      this.errorMsg.textContent = 'Please enter a profile name.';
      this.errorMsg.className = 'error-message visible';
      return;
    }

    if (this.options.existingNames.includes(name)) {
      this.errorMsg.textContent = `A profile named "${name}" already exists. Choose a different name.`;
      this.errorMsg.className = 'error-message visible';
      return;
    }

    const text = this.textarea.value.trim();
    if (!text) {
      this.errorMsg.textContent = 'Please describe yourself to create a profile.';
      this.errorMsg.className = 'error-message visible';
      return;
    }

    const profile = parseProfileText(text);
    this.options.onSave(name, profile);
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
        const focusable = Array.from(
          this.shadow.querySelectorAll('input, textarea, button')
        ) as HTMLElement[];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (ke.shiftKey && this.shadow.activeElement === first) {
          ke.preventDefault();
          last?.focus();
        } else if (!ke.shiftKey && this.shadow.activeElement === last) {
          ke.preventDefault();
          first?.focus();
        }
      }
    });

    setTimeout(() => this.nameInput?.focus(), 50);
  }

  destroy(): void {
    if (this.previousFocus) {
      this.previousFocus.focus();
    }
    this.host.remove();
    if (activeCreateOverlay === this) {
      activeCreateOverlay = null;
    }
  }
}

export function showProfileCreate(options: ProfileCreateOptions): ProfileCreateOverlay {
  if (activeCreateOverlay) {
    activeCreateOverlay.destroy();
  }
  activeCreateOverlay = new ProfileCreateOverlay(options);
  return activeCreateOverlay;
}
