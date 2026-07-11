import { scanPage } from '../../scanner/index';
import type { ListFieldsResult } from '../types';

export function listFields(): ListFieldsResult {
  const schema = scanPage();
  return {
    ok: true,
    fields: schema.fields,
    count: schema.fields.length,
  };
}
