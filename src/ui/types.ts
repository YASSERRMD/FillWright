export interface DiffItem {
  field_id: string;
  label: string;
  oldValue: string;
  newValue: string;
  confidence: number;
  accepted: boolean;
  step?: string;
}

export interface OverlayOptions {
  mode: 'review-before-fill' | 'review-before-submit';
  onConfirm: (acceptedItems: DiffItem[]) => void;
  onCancel: () => void;
  items: DiffItem[];
}

export type OverlayMode = 'review-before-fill' | 'review-before-submit';
