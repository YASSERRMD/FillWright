import type { OrchestrationConfig, OrchestrationEvent, OrchestrationListener, OrchestrationResult } from './types';
import { scanPage } from '../../scanner';
import { generateFillPlan } from '../index';
import { execute } from '../../mcp/executor';

const DEFAULT_CONFIG: OrchestrationConfig = {
  maxCorrectionRounds: 2,
  maxSteps: 20,
  stallTimeoutMs: 30000,
};

export class Orchestrator {
  private config: OrchestrationConfig;
  private listeners: OrchestrationListener[] = [];
  private events: OrchestrationEvent[] = [];
  private stallTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config?: Partial<OrchestrationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  onEvent(listener: OrchestrationListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(type: OrchestrationEvent['type'], data?: Record<string, unknown>): void {
    const event: OrchestrationEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    this.events.push(event);
    this.listeners.forEach((l) => l(event));
    this.resetStallTimer();
  }

  private resetStallTimer(): void {
    if (this.stallTimer) {
      clearTimeout(this.stallTimer);
    }
    this.stallTimer = setTimeout(() => {
      this.emit('error', { message: 'Stall detected' });
    }, this.config.stallTimeoutMs);
  }

  private stopStallTimer(): void {
    if (this.stallTimer) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
  }

  async run(profile: Record<string, string>): Promise<OrchestrationResult> {
    this.events = [];

    try {
      let stepCount = 0;

      while (stepCount < this.config.maxSteps) {
        this.emit('scan_started');
        const schema = scanPage();

        if (schema.fields.length === 0) {
          break;
        }

        const planResult = await generateFillPlan(schema, profile);
        if (!planResult.ok) {
          this.emit('error', { message: planResult.error });
          this.stopStallTimer();
          return { ok: false, events: this.events, error: planResult.error };
        }

        this.emit('plan_received', {
          source: planResult.source,
          stepCount: planResult.plan.length,
        });

        const filledFields: string[] = [];

        for (const step of planResult.plan) {
          const result = execute(step.tool as 'fill_field' | 'select_option' | 'toggle', {
            field_id: step.field_id,
            value: step.value,
            state: step.value === 'true',
          });

          if ('ok' in result && result.ok) {
            filledFields.push(step.field_id);
            this.emit('field_filled', {
              field_id: step.field_id,
              value: step.value,
            });
          }
        }

        const validationResult = execute('read_validation_errors', {}) as { ok: boolean; errors: unknown[] };

        if (validationResult.ok && Array.isArray(validationResult.errors) && validationResult.errors.length > 0) {
          this.emit('validation_read', {
            errorCount: validationResult.errors.length,
          });

          const correctionPlanResult = await generateFillPlan(schema, profile);
          if (correctionPlanResult.ok) {
            this.emit('correction', {
              round: stepCount,
            });

            for (const step of correctionPlanResult.plan) {
              if (filledFields.includes(step.field_id)) continue;

              execute(step.tool as 'fill_field' | 'select_option' | 'toggle', {
                field_id: step.field_id,
                value: step.value,
                state: step.value === 'true',
              });
            }
          }
        }

        const nextResult = execute('next_step', {}) as { ok: boolean; error?: string };
        if (!nextResult.ok) {
          this.emit('awaiting_confirmation');
          this.stopStallTimer();
          return { ok: true, events: this.events };
        }

        this.emit('step_advanced', { step: stepCount });
        stepCount++;
      }

      this.emit('completed');
      this.stopStallTimer();
      return { ok: true, events: this.events };
    } catch (err) {
      this.stopStallTimer();
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.emit('error', { message });
      return { ok: false, events: this.events, error: message };
    }
  }

  getEvents(): OrchestrationEvent[] {
    return [...this.events];
  }
}
