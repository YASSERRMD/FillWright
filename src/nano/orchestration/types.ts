export type OrchestrationEventType =
  | 'scan_started'
  | 'plan_received'
  | 'field_filled'
  | 'validation_read'
  | 'correction'
  | 'step_advanced'
  | 'awaiting_confirmation'
  | 'completed'
  | 'error';

export interface OrchestrationEvent {
  type: OrchestrationEventType;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface OrchestrationConfig {
  maxCorrectionRounds: number;
  maxSteps: number;
  stallTimeoutMs: number;
}

export interface OrchestrationResult {
  ok: boolean;
  events: OrchestrationEvent[];
  error?: string;
}

export type OrchestrationListener = (event: OrchestrationEvent) => void;
