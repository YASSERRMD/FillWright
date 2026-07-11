export interface ToolResult {
  ok: boolean;
  field_id?: string;
  applied_value?: string;
  error?: string;
}

export interface FillItem {
  field_id: string;
  value: string;
}

export interface ValidationState {
  field_id: string;
  valid: boolean;
  validationMessage: string;
  ariaInvalid: boolean;
  errorText: string | null;
}

export interface ListFieldsResult {
  ok: boolean;
  fields: unknown[];
  count: number;
}

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ToolName =
  | 'list_fields'
  | 'fill_field'
  | 'select_option'
  | 'toggle'
  | 'read_validation_errors'
  | 'next_step'
  | 'submit'
  | 'fill_many';
