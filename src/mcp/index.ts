export type { ToolResult, FillItem, ValidationState, ListFieldsResult, ToolSchema, ToolName } from './types';
export { setNativeValue, setNativeSelectValue, setNativeChecked } from './dom';
export { execute } from './executor';
export { listFields } from './tools/list-fields';
export { fillField } from './tools/fill-field';
export { selectOption } from './tools/select-option';
export { toggle } from './tools/toggle';
export { readValidationErrors } from './tools/read-validation-errors';
export { nextStep } from './tools/next-step';
export { submit } from './tools/submit';
export { fillMany } from './tools/fill-many';

export function getToolSchemas() {
  return [
    {
      name: 'list_fields',
      description: 'Returns the current FormSchema from the scanner',
      inputSchema: {},
    },
    {
      name: 'fill_field',
      description: 'Sets a text or number value on a field',
      inputSchema: { field_id: 'string', value: 'string' },
    },
    {
      name: 'select_option',
      description: 'Selects a dropdown option by value or visible label',
      inputSchema: { field_id: 'string', value: 'string' },
    },
    {
      name: 'toggle',
      description: 'Sets a checkbox on or off',
      inputSchema: { field_id: 'string', state: 'boolean' },
    },
    {
      name: 'read_validation_errors',
      description: 'Returns per-field validation state',
      inputSchema: {},
    },
    {
      name: 'next_step',
      description: 'Advances a multi-step wizard',
      inputSchema: {},
    },
    {
      name: 'submit',
      description: 'Triggers form submission (gated, returns pending-confirmation)',
      inputSchema: {},
    },
    {
      name: 'fill_many',
      description: 'Fills multiple fields in one call',
      inputSchema: { items: 'FillItem[]' },
    },
  ];
}
