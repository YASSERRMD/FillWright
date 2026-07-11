import type { ToolResult, FillItem } from '../types';
import { fillField } from './fill-field';

export function fillMany(items: FillItem[]): ToolResult[] {
  return items.map((item) => fillField(item.field_id, item.value));
}
