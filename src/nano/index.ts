export type NanoStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export interface FillPlanStep {
  tool: string;
  field_id: string;
  value: string;
  confidence: number;
}

export type FillPlan = FillPlanStep[];

export async function checkAvailability(): Promise<NanoStatus> {
  return 'unavailable';
}

export async function createSession(): Promise<void> {
  return;
}
