import { describe, it, expect, beforeEach } from 'vitest';
import { fillField } from './fill-field';
import { scanPage } from '../../scanner';

function createLabeledInput(name: string): HTMLInputElement {
  const label = document.createElement('label');
  label.textContent = 'Test Field';
  label.setAttribute('for', `test-${name}`);

  const input = document.createElement('input');
  input.id = `test-${name}`;
  input.name = name;
  input.type = 'text';

  document.body.appendChild(label);
  document.body.appendChild(input);
  return input;
}

describe('fillField', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should fill a field by id', () => {
    createLabeledInput('username');

    const schema = scanPage();
    const fieldId = schema.fields[0]?.field_id;
    expect(fieldId).toBeDefined();

    const result = fillField(fieldId!, 'alice');

    expect(result.ok).toBe(true);
    expect(result.applied_value).toBe('alice');
  });

  it('should return error for non-existent field', () => {
    const result = fillField('nonexistent', 'value');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Field not found');
  });
});
