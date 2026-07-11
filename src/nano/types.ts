export interface FillPlanStep {
  tool: string;
  field_id: string;
  value: string;
  confidence: number;
}

export type FillPlan = FillPlanStep[];

export type NanoStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export interface NanoSession {
  prompt: (input: string) => Promise<string>;
  destroy: () => void;
}

export interface PromptBuilderOptions {
  schemaJson: string;
  profileJson: string;
}
