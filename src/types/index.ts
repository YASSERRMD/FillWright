export interface FormField {
  field_id: string;
  selector: string;
  type: string;
  name: string | null;
  id: string | null;
  autocomplete: string | null;
  label: string | null;
  required: boolean;
  pattern: string | null;
  maxlength: number | null;
  min: number | null;
  max: number | null;
  step: number | null;
  options: { value: string; label: string }[] | null;
  currentValue: string;
  nearbyText: string | null;
  step_hint?: string;
}

export interface FormSchema {
  url: string;
  title: string;
  fields: FormField[];
  timestamp: number;
  tokenEstimate: number;
}

export interface ScanOptions {
  includeHidden: boolean;
  debounceMs: number;
}
