import { describe, it, expect, beforeEach } from 'vitest';
import { Orchestrator } from './orchestrator';

describe('Orchestrator', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should create orchestrator with default config', () => {
    const orch = new Orchestrator();
    expect(orch).toBeDefined();
  });

  it('should create orchestrator with custom config', () => {
    const orch = new Orchestrator({ maxCorrectionRounds: 5, maxSteps: 10 });
    expect(orch).toBeDefined();
  });

  it('should register and unregister listeners', () => {
    const orch = new Orchestrator();
    const events: string[] = [];
    const unsub = orch.onEvent((e) => events.push(e.type));

    orch.onEvent(() => {});
    unsub();
    orch.onEvent(() => {});

    expect(typeof unsub).toBe('function');
  });

  it('should complete with empty page', async () => {
    const orch = new Orchestrator();
    const result = await orch.run({});
    expect(result.ok).toBe(true);
  });

  it('should emit scan_started event', async () => {
    const orch = new Orchestrator();
    const events: string[] = [];
    orch.onEvent((e) => events.push(e.type));

    await orch.run({});

    expect(events).toContain('scan_started');
  });

  it('should return events history', async () => {
    const orch = new Orchestrator();
    await orch.run({});
    const events = orch.getEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toHaveProperty('type');
    expect(events[0]).toHaveProperty('timestamp');
  });
});
