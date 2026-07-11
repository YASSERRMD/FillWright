import type { NanoSession } from './types';

let currentSession: NanoSession | null = null;
let sessionSystemPrompt = '';

export async function createSession(systemPrompt: string): Promise<NanoSession> {
  if (currentSession) {
    currentSession.destroy();
    currentSession = null;
  }

  if (!window.LanguageModel) {
    throw new Error('LanguageModel API not available');
  }

  sessionSystemPrompt = systemPrompt;
  const session = await window.LanguageModel.createSession({
    systemPrompt,
  });

  currentSession = {
    prompt: session.prompt,
    destroy: () => {
      session.destroy();
      currentSession = null;
    },
  };

  return currentSession;
}

export function getSession(): NanoSession | null {
  return currentSession;
}

export function resetSession(): void {
  if (currentSession) {
    currentSession.destroy();
    currentSession = null;
  }
}

export function getSessionSystemPrompt(): string {
  return sessionSystemPrompt;
}
