const SELECTOR_ID = 'fillwright-profile-selector';

const STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    position: fixed;
    bottom: 120px;
    right: 20px;
    z-index: 2147483646;
  }

  .selector-wrapper {
    position: relative;
  }

  .active-profile-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: white;
    border: 1px solid #d0d0d0;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    color: #1B2A4A;
    max-width: 180px;
    transition: border-color 0.15s;
  }

  .active-profile-btn:hover {
    border-color: #C5A55A;
  }

  .profile-icon {
    width: 20px;
    height: 20px;
    background: #C5A55A;
    color: #1B2A4A;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .profile-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .chevron {
    font-size: 10px;
    color: #999;
    flex-shrink: 0;
  }

  .dropdown {
    position: absolute;
    bottom: calc(100% + 6px);
    right: 0;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    min-width: 200px;
    max-width: 260px;
    display: none;
    overflow: hidden;
  }

  .dropdown.open {
    display: block;
  }

  .dropdown-header {
    padding: 10px 14px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #999;
    border-bottom: 1px solid #f0f0f0;
  }

  .dropdown-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.1s;
  }

  .dropdown-item:hover {
    background: #f8f8f8;
  }

  .dropdown-item.active {
    background: #f2f2f2;
    font-weight: 600;
  }

  .dropdown-item .item-icon {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .dropdown-item .item-icon.gold {
    background: #C5A55A;
    color: #1B2A4A;
  }

  .dropdown-item .item-icon.navy {
    background: #1B2A4A;
    color: white;
  }

  .dropdown-item .item-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .dropdown-item .checkmark {
    color: #C5A55A;
    font-size: 16px;
    display: none;
  }

  .dropdown-item.active .checkmark {
    display: block;
  }

  .dropdown-divider {
    height: 1px;
    background: #f0f0f0;
  }

  .dropdown-action {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    cursor: pointer;
    font-size: 13px;
    color: #1B2A4A;
    font-weight: 500;
  }

  .dropdown-action:hover {
    background: #f8f8f8;
  }

  .dropdown-action .action-icon {
    font-size: 16px;
    color: #C5A55A;
  }
`;

export interface ProfileSelectorOptions {
  profiles: string[];
  activeProfile: string;
  onSelect: (name: string) => void;
  onCreateNew: () => void;
}

export class ProfileSelector {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private options: ProfileSelectorOptions;
  private dropdown!: HTMLDivElement;
  private isOpen = false;

  constructor(options: ProfileSelectorOptions) {
    this.options = options;
    this.host = document.createElement('div');
    this.host.id = SELECTOR_ID;
    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.render();
    document.body.appendChild(this.host);
    this.setupCloseOnOutsideClick();
  }

  private render(): void {
    const style = document.createElement('style');
    style.textContent = STYLES;

    const wrapper = document.createElement('div');
    wrapper.className = 'selector-wrapper';

    wrapper.appendChild(this.renderActiveButton());
    this.dropdown = this.renderDropdown();
    wrapper.appendChild(this.dropdown);

    this.shadow.appendChild(style);
    this.shadow.appendChild(wrapper);
  }

  private renderActiveButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'active-profile-btn';

    const icon = document.createElement('div');
    icon.className = 'profile-icon';
    icon.textContent = this.getInitial(this.options.activeProfile);

    const name = document.createElement('span');
    name.className = 'profile-name';
    name.textContent = this.options.activeProfile;

    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.textContent = '\u25B2';

    btn.appendChild(icon);
    btn.appendChild(name);
    btn.appendChild(chevron);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    return btn;
  }

  private renderDropdown(): HTMLDivElement {
    const dd = document.createElement('div');
    dd.className = 'dropdown';

    const header = document.createElement('div');
    header.className = 'dropdown-header';
    header.textContent = 'Profiles';
    dd.appendChild(header);

    const list = document.createElement('div');
    list.className = 'dropdown-list';

    for (const name of this.options.profiles) {
      const item = document.createElement('div');
      item.className = `dropdown-item ${name === this.options.activeProfile ? 'active' : ''}`;

      const itemIcon = document.createElement('div');
      itemIcon.className = `item-icon ${name === this.options.activeProfile ? 'gold' : 'navy'}`;
      itemIcon.textContent = this.getInitial(name);

      const itemName = document.createElement('span');
      itemName.className = 'item-name';
      itemName.textContent = name;

      const check = document.createElement('span');
      check.className = 'checkmark';
      check.textContent = '\u2713';

      item.appendChild(itemIcon);
      item.appendChild(itemName);
      item.appendChild(check);

      item.addEventListener('click', () => {
        this.options.onSelect(name);
        this.close();
      });

      list.appendChild(item);
    }

    dd.appendChild(list);

    const divider = document.createElement('div');
    divider.className = 'dropdown-divider';
    dd.appendChild(divider);

    const createBtn = document.createElement('div');
    createBtn.className = 'dropdown-action';
    const createIcon = document.createElement('span');
    createIcon.className = 'action-icon';
    createIcon.textContent = '+';
    const createText = document.createElement('span');
    createText.textContent = 'Create new profile';
    createBtn.appendChild(createIcon);
    createBtn.appendChild(createText);
    createBtn.addEventListener('click', () => {
      this.close();
      this.options.onCreateNew();
    });
    dd.appendChild(createBtn);

    return dd;
  }

  private getInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  private toggle(): void {
    this.isOpen = !this.isOpen;
    this.dropdown.className = `dropdown ${this.isOpen ? 'open' : ''}`;
  }

  private close(): void {
    this.isOpen = false;
    this.dropdown.className = 'dropdown';
  }

  private setupCloseOnOutsideClick(): void {
    const handler = (e: MouseEvent) => {
      if (!this.host.contains(e.target as Node)) {
        this.close();
      }
    };
    document.addEventListener('click', handler);
  }

  update(profiles: string[], active: string): void {
    this.options.profiles = profiles;
    this.options.activeProfile = active;
    this.shadow.innerHTML = '';
    this.render();
  }

  destroy(): void {
    this.host.remove();
  }
}
