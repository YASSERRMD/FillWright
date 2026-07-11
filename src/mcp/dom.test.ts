import { describe, it, expect, beforeEach } from 'vitest';
import { setNativeValue, setNativeSelectValue, setNativeChecked } from './dom';

describe('setNativeValue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should set input value and dispatch events', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    let inputFired = false;
    let changeFired = false;
    input.addEventListener('input', () => { inputFired = true; });
    input.addEventListener('change', () => { changeFired = true; });

    setNativeValue(input, 'hello');

    expect(input.value).toBe('hello');
    expect(inputFired).toBe(true);
    expect(changeFired).toBe(true);
  });

  it('should set textarea value and dispatch events', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    let inputFired = false;
    textarea.addEventListener('input', () => { inputFired = true; });

    setNativeValue(textarea, 'hello');

    expect(textarea.value).toBe('hello');
    expect(inputFired).toBe(true);
  });
});

describe('setNativeSelectValue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should set select value and dispatch change', () => {
    const select = document.createElement('select');
    const opt1 = document.createElement('option');
    opt1.value = 'a';
    const opt2 = document.createElement('option');
    opt2.value = 'b';
    select.appendChild(opt1);
    select.appendChild(opt2);
    document.body.appendChild(select);

    let changeFired = false;
    select.addEventListener('change', () => { changeFired = true; });

    setNativeSelectValue(select, 'b');

    expect(select.value).toBe('b');
    expect(changeFired).toBe(true);
  });
});

describe('setNativeChecked', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should set checkbox checked and dispatch events', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    document.body.appendChild(checkbox);

    let clickFired = false;
    let changeFired = false;
    checkbox.addEventListener('click', () => { clickFired = true; });
    checkbox.addEventListener('change', () => { changeFired = true; });

    setNativeChecked(checkbox, true);

    expect(checkbox.checked).toBe(true);
    expect(clickFired).toBe(true);
    expect(changeFired).toBe(true);
  });
});
