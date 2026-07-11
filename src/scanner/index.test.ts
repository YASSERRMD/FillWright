import { describe, it, expect, beforeEach } from 'vitest';
import { scanPage } from './index';

function createInput(attrs: Record<string, string>): HTMLInputElement {
  const input = document.createElement('input');
  for (const [key, value] of Object.entries(attrs)) {
    input.setAttribute(key, value);
  }
  document.body.appendChild(input);
  return input;
}

function createLabel(text: string, htmlFor: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.textContent = text;
  label.setAttribute('for', htmlFor);
  document.body.appendChild(label);
  return label;
}

function createSelect(
  name: string,
  options: { value: string; label: string }[]
): HTMLSelectElement {
  const select = document.createElement('select');
  select.setAttribute('name', name);
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    select.appendChild(option);
  }
  document.body.appendChild(select);
  return select;
}

function createRadioGroup(
  name: string,
  options: { value: string; label: string }[]
): HTMLInputElement[] {
  const radios: HTMLInputElement[] = [];
  for (const opt of options) {
    const radio = document.createElement('input');
    radio.setAttribute('type', 'radio');
    radio.setAttribute('name', name);
    radio.value = opt.value;

    const label = document.createElement('label');
    label.textContent = opt.label;
    label.appendChild(radio);

    document.body.appendChild(label);
    radios.push(radio);
  }
  return radios;
}

function createHiddenInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.setAttribute('type', 'hidden');
  input.setAttribute('name', 'hidden-field');
  document.body.appendChild(input);
  return input;
}

function createDisplayNoneInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.setAttribute('name', 'hidden-style');
  input.style.display = 'none';
  document.body.appendChild(input);
  return input;
}

function createWizardStep(step: string, isActive: boolean): HTMLDivElement {
  const div = document.createElement('div');
  div.setAttribute('data-step', step);
  if (isActive) {
    div.classList.add('active');
  }

  const input = document.createElement('input');
  input.setAttribute('name', `step-${step}-field`);
  div.appendChild(input);

  document.body.appendChild(div);
  return div;
}

function createContentEditable(): HTMLDivElement {
  const div = document.createElement('div');
  div.setAttribute('contenteditable', 'true');
  div.setAttribute('role', 'textbox');
  document.body.appendChild(div);
  return div;
}

describe('Scanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should detect labeled inputs', () => {
    createLabel('Email', 'email-input');
    createInput({ id: 'email-input', name: 'email', type: 'email' });

    const schema = scanPage();
    expect(schema.fields).toHaveLength(1);
    expect(schema.fields[0]?.label).toBe('Email');
    expect(schema.fields[0]?.name).toBe('email');
    expect(schema.fields[0]?.type).toBe('email');
  });

  it('should detect aria-labeled fields', () => {
    createInput({
      'aria-label': 'Username',
      name: 'username',
      type: 'text',
    });

    const schema = scanPage();
    expect(schema.fields).toHaveLength(1);
    expect(schema.fields[0]?.label).toBe('Username');
    expect(schema.fields[0]?.selector).toContain('input');
  });

  it('should detect radio groups', () => {
    createRadioGroup('color', [
      { value: 'red', label: 'Red' },
      { value: 'blue', label: 'Blue' },
    ]);

    const schema = scanPage();
    expect(schema.fields).toHaveLength(1);
    expect(schema.fields[0]?.options).toHaveLength(2);
    expect(schema.fields[0]?.options?.[0]?.label).toBe('Red');
    expect(schema.fields[0]?.options?.[1]?.label).toBe('Blue');
  });

  it('should detect selects with options', () => {
    createSelect('country', [
      { value: 'us', label: 'United States' },
      { value: 'uk', label: 'United Kingdom' },
    ]);

    const schema = scanPage();
    expect(schema.fields).toHaveLength(1);
    expect(schema.fields[0]?.type).toBe('select-one');
    expect(schema.fields[0]?.options).toHaveLength(2);
    expect(schema.fields[0]?.options?.[0]?.value).toBe('us');
  });

  it('should prune hidden fields', () => {
    createHiddenInput();
    createDisplayNoneInput();
    createInput({ name: 'visible', type: 'text' });

    const schema = scanPage();
    expect(schema.fields).toHaveLength(1);
    expect(schema.fields[0]?.name).toBe('visible');
  });

  it('should mark inactive wizard step fields with step_hint', () => {
    createWizardStep('1', false);
    createWizardStep('2', true);

    const schema = scanPage();
    expect(schema.fields).toHaveLength(2);

    const step1Field = schema.fields.find((f) => f.step_hint === '1');
    const step2Field = schema.fields.find((f) => !f.step_hint);

    expect(step1Field).toBeDefined();
    expect(step2Field).toBeDefined();
  });

  it('should detect contenteditable elements', () => {
    createContentEditable();

    const schema = scanPage();
    expect(schema.fields).toHaveLength(1);
    expect(schema.fields[0]?.type).toBe('contenteditable');
  });

  it('should generate stable field_ids', () => {
    createInput({ id: 'stable-test', name: 'test', type: 'text' });

    const schema1 = scanPage();
    const schema2 = scanPage();

    expect(schema1.fields[0]?.field_id).toBe(schema2.fields[0]?.field_id);
  });

  it('should estimate tokens', () => {
    createInput({ name: 'field1', type: 'text' });
    createInput({ name: 'field2', type: 'text' });

    const schema = scanPage();
    expect(schema.tokenEstimate).toBeGreaterThan(0);
  });

  it('should capture current values', () => {
    const input = createInput({ name: 'prefilled', type: 'text' });
    input.value = 'existing value';

    const schema = scanPage();
    expect(schema.fields[0]?.currentValue).toBe('existing value');
  });

  it('should capture nearby text', () => {
    const wrapper = document.createElement('div');
    const text = document.createTextNode('Please enter your email');
    const input = createInput({ name: 'email', type: 'email' });
    wrapper.appendChild(text);
    wrapper.appendChild(input);
    document.body.appendChild(wrapper);

    const schema = scanPage();
    expect(schema.fields[0]?.nearbyText).toContain('Please enter your email');
  });

  it('should set url and title', () => {
    const schema = scanPage();
    expect(schema.url).toBeDefined();
    expect(schema.title).toBeDefined();
  });

  it('should set timestamp', () => {
    const before = Date.now();
    const schema = scanPage();
    const after = Date.now();

    expect(schema.timestamp).toBeGreaterThanOrEqual(before);
    expect(schema.timestamp).toBeLessThanOrEqual(after);
  });
});
