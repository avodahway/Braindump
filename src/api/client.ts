import { parseBrainDump } from '../lib/parser';
import type { BrainDumpRequest, BrainDumpResponse, ParsedAction } from '../lib/types';

const settingsKey = 'brain-dump-settings';

export type BackendSettings = {
  backendUrl: string;
  sharedSecret: string;
};

export function loadSettings(): BackendSettings {
  try {
    return JSON.parse(localStorage.getItem(settingsKey) ?? '{"backendUrl":"","sharedSecret":""}');
  } catch {
    return { backendUrl: '', sharedSecret: '' };
  }
}

export function saveSettings(settings: BackendSettings): void {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

export async function processBrainDump(request: BrainDumpRequest): Promise<BrainDumpResponse> {
  const settings = loadSettings();
  if (!settings.backendUrl) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return markCreated(parseBrainDump(request.text, request.requestId));
  }

  const response = await fetch(settings.backendUrl, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      ...request,
      sharedSecret: settings.sharedSecret || undefined
    })
  });

  if (!response.ok) {
    throw new Error(`Bridge returned ${response.status}`);
  }

  return response.json();
}

function markCreated(response: BrainDumpResponse): BrainDumpResponse {
  return {
    ...response,
    actions: response.actions.map((action): ParsedAction => ({
      ...action,
      status: action.status === 'needs_review' ? 'needs_review' : 'created'
    }))
  };
}
