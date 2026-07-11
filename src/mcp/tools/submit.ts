import type { ToolResult } from '../types';

export function submit(): ToolResult {
  return {
    ok: true,
    applied_value: 'pending-confirmation',
  };
}
