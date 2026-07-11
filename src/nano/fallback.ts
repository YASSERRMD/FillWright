import type { FillPlan, FillPlanStep } from './types';
import type { FormSchema, FormField } from '../types';

interface AutocompleteMapping {
  pattern: RegExp;
  profileKey: string;
  tool: string;
}

const AUTOCOMPLETE_MAPPINGS: AutocompleteMapping[] = [
  { pattern: /^given-name$/i, profileKey: 'identity.givenName', tool: 'fill_field' },
  { pattern: /^family-name$/i, profileKey: 'identity.familyName', tool: 'fill_field' },
  { pattern: /^name$/i, profileKey: 'identity.fullName', tool: 'fill_field' },
  { pattern: /^email$/i, profileKey: 'contact.email', tool: 'fill_field' },
  { pattern: /^tel$/i, profileKey: 'contact.phone', tool: 'fill_field' },
  { pattern: /^street-address$/i, profileKey: 'contact.addresses.0', tool: 'fill_field' },
  { pattern: /^country$/i, profileKey: 'contact.country', tool: 'select_option' },
  { pattern: /^passport$/i, profileKey: 'documents.passport', tool: 'fill_field' },
  { pattern: /^national-id$/i, profileKey: 'documents.nationalId', tool: 'fill_field' },
  { pattern: /^organization$/i, profileKey: 'employment.employer', tool: 'fill_field' },
  { pattern: /^organization-title$/i, profileKey: 'employment.jobTitle', tool: 'fill_field' },
];

const LABEL_MAPPINGS: Array<{ patterns: RegExp[]; profileKey: string; tool: string }> = [
  { patterns: [/first\s*name/i], profileKey: 'identity.givenName', tool: 'fill_field' },
  { patterns: [/last\s*name/i, /family\s*name/i, /surname/i], profileKey: 'identity.familyName', tool: 'fill_field' },
  { patterns: [/full\s*name/i, /^name$/i], profileKey: 'identity.fullName', tool: 'fill_field' },
  { patterns: [/e-?mail/i], profileKey: 'contact.email', tool: 'fill_field' },
  { patterns: [/phone/i, /mobile/i, /cell/i], profileKey: 'contact.phone', tool: 'fill_field' },
  { patterns: [/address/i, /street/i], profileKey: 'contact.addresses.0', tool: 'fill_field' },
  { patterns: [/country/i], profileKey: 'contact.country', tool: 'select_option' },
  { patterns: [/passport/i], profileKey: 'documents.passport', tool: 'fill_field' },
  { patterns: [/national\s*id/i, /id\s*number/i], profileKey: 'documents.nationalId', tool: 'fill_field' },
  { patterns: [/employer/i, /company/i, /organization/i], profileKey: 'employment.employer', tool: 'fill_field' },
  { patterns: [/job\s*title/i, /position/i, /role/i], profileKey: 'employment.jobTitle', tool: 'fill_field' },
];

function matchAutocomplete(field: FormField): AutocompleteMapping | null {
  if (!field.autocomplete) return null;

  for (const mapping of AUTOCOMPLETE_MAPPINGS) {
    if (mapping.pattern.test(field.autocomplete)) {
      return mapping;
    }
  }

  return null;
}

function matchLabel(field: FormField): { profileKey: string; tool: string } | null {
  if (!field.label) return null;

  for (const mapping of LABEL_MAPPINGS) {
    for (const pattern of mapping.patterns) {
      if (pattern.test(field.label)) {
        return { profileKey: mapping.profileKey, tool: mapping.tool };
      }
    }
  }

  return null;
}

export function generateFallbackPlan(
  schema: FormSchema,
  profile: Record<string, string>
): FillPlan {
  const plan: FillPlanStep[] = [];

  for (const field of schema.fields) {
    if (field.hidden) continue;
    if (field.type === 'hidden') continue;

    let profileKey: string | null = null;
    let tool = 'fill_field';

    const autocompleteMatch = matchAutocomplete(field);
    if (autocompleteMatch) {
      profileKey = autocompleteMatch.profileKey;
      tool = autocompleteMatch.tool;
    } else {
      const labelMatch = matchLabel(field);
      if (labelMatch) {
        profileKey = labelMatch.profileKey;
        tool = labelMatch.tool;
      }
    }

    if (!profileKey) continue;

    const value = profile[profileKey] ?? '';
    if (!value) continue;

    if (tool === 'select_option' && field.options) {
      const optionMatch = field.options.find(
        (opt) =>
          opt.label.toLowerCase() === value.toLowerCase() ||
          opt.value.toLowerCase() === value.toLowerCase()
      );
      if (!optionMatch) continue;
    }

    plan.push({
      tool,
      field_id: field.field_id,
      value,
      confidence: 0.7,
    });
  }

  return plan;
}
