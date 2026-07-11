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

export function list_fields(): unknown {
  return { fields: [] };
}

export function fill_field(field_id: string, value: string): ToolResult {
  return { ok: true, field_id, applied_value: value };
}

export function select_option(field_id: string, value: string): ToolResult {
  return { ok: true, field_id, applied_value: value };
}

export function toggle(field_id: string, state: boolean): ToolResult {
  return { ok: true, field_id, applied_value: String(state) };
}

export function read_validation_errors(): unknown {
  return { errors: [] };
}

export function next_step(): ToolResult {
  return { ok: true };
}

export function submit(): ToolResult {
  return { ok: true };
}

export function fill_many(items: FillItem[]): ToolResult[] {
  return items.map((item) => fill_field(item.field_id, item.value));
}
