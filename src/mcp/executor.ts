import type { ToolName, ToolResult } from './types';
import { listFields } from './tools/list-fields';
import { fillField } from './tools/fill-field';
import { selectOption } from './tools/select-option';
import { toggle } from './tools/toggle';
import { readValidationErrors } from './tools/read-validation-errors';
import { nextStep } from './tools/next-step';
import { submit } from './tools/submit';
import { fillMany } from './tools/fill-many';

export function execute(toolName: ToolName, args: Record<string, unknown>): ToolResult | { ok: boolean; fields: unknown[]; count: number } | { ok: boolean; errors: unknown[] } | ToolResult[] {
  switch (toolName) {
    case 'list_fields':
      return listFields();

    case 'fill_field': {
      const fieldId = args.field_id as string;
      const value = args.value as string;
      if (!fieldId || !value) {
        return { ok: false, error: 'Missing required args: field_id, value' };
      }
      return fillField(fieldId, value);
    }

    case 'select_option': {
      const fieldId = args.field_id as string;
      const value = args.value as string;
      if (!fieldId || !value) {
        return { ok: false, error: 'Missing required args: field_id, value' };
      }
      return selectOption(fieldId, value);
    }

    case 'toggle': {
      const fieldId = args.field_id as string;
      const state = args.state as boolean;
      if (!fieldId || typeof state !== 'boolean') {
        return { ok: false, error: 'Missing required args: field_id, state (boolean)' };
      }
      return toggle(fieldId, state);
    }

    case 'read_validation_errors':
      return readValidationErrors();

    case 'next_step':
      return nextStep();

    case 'submit':
      return submit();

    case 'fill_many': {
      const items = args.items as Array<{ field_id: string; value: string }>;
      if (!Array.isArray(items)) {
        return { ok: false, error: 'Missing required arg: items (array)' };
      }
      return fillMany(items);
    }

    default:
      return { ok: false, error: `Unknown tool: ${toolName}` };
  }
}
