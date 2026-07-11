import type { FormField, TokenEstimate } from '../types';

export function estimateTokens(fields: FormField[]): TokenEstimate {
  const characters = fields.reduce((sum, f) => {
    let fieldChars = 0;
    fieldChars += f.field_id.length;
    fieldChars += f.selector.length;
    fieldChars += f.type.length;
    fieldChars += (f.name ?? '').length;
    fieldChars += (f.label ?? '').length;
    fieldChars += (f.nearbyText ?? '').length;
    fieldChars += f.currentValue.length;
    if (f.options) {
      fieldChars += f.options.reduce((optSum, opt) => optSum + opt.value.length + opt.label.length, 0);
    }
    return sum + fieldChars;
  }, 0);

  return {
    fields: fields.length,
    characters,
    estimatedTokens: Math.ceil(characters / 4),
  };
}
