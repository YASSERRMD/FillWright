import type { NanoStatus } from './types';

interface LanguageModel {
  availability: () => Promise<NanoStatus>;
  createSession: (options: { systemPrompt: string }) => Promise<{
    prompt: (input: string) => Promise<string>;
    destroy: () => void;
  }>;
}

declare global {
  interface Window {
    LanguageModel?: LanguageModel;
  }
}

export async function checkAvailability(): Promise<NanoStatus> {
  if (!window.LanguageModel) {
    return 'unavailable';
  }

  try {
    const status = await window.LanguageModel.availability();
    return status as NanoStatus;
  } catch {
    return 'unavailable';
  }
}

export async function downloadModel(
  onProgress?: (progress: number) => void
): Promise<boolean> {
  if (!window.LanguageModel) {
    return false;
  }

  try {
    const status = await window.LanguageModel.availability();
    if (status === 'available') {
      return true;
    }

    if (status === 'downloadable') {
      const session = await window.LanguageModel.createSession({
        systemPrompt: 'You are a download trigger.',
      });
      onProgress?.(100);
      session.destroy();
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
