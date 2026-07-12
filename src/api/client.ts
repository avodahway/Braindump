import { parseBrainDump } from '../lib/parser';
import type { BrainDumpRequest, BrainDumpResponse, ParsedAction } from '../lib/types';
import { processPublicBrainDump } from './publicClient';
import { loadWorkspace } from './workspace';

const settingsKey = 'brain-dump-settings';

export type BackendSettings = {
  backendMode: 'mock' | 'public' | 'private_apps_script';
  publicApiBaseUrl: string;
  backendUrl: string;
  sharedSecret: string;
};

export function loadSettings(): BackendSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(settingsKey) ?? '{}') as Partial<BackendSettings>;
    return {
      backendMode: parsed.backendMode ?? (parsed.backendUrl ? 'private_apps_script' : 'mock'),
      publicApiBaseUrl: parsed.publicApiBaseUrl ?? '',
      backendUrl: parsed.backendUrl ?? '',
      sharedSecret: parsed.sharedSecret ?? ''
    };
  } catch {
    return { backendMode: 'mock', publicApiBaseUrl: '', backendUrl: '', sharedSecret: '' };
  }
}

export function saveSettings(settings: BackendSettings): void {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

export async function processBrainDump(request: BrainDumpRequest): Promise<BrainDumpResponse> {
  const settings = loadSettings();
  if (settings.backendMode === 'mock') {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return markCreated(request.approvedActions ? responseFromApprovedActions(request) : parseBrainDump(request.text, request.requestId));
  }

  if (settings.backendMode === 'public') {
    if (settings.publicApiBaseUrl) {
      return processPublicBrainDump(settings.publicApiBaseUrl, request);
    }
    if (loadWorkspace().status !== 'connected') {
      throw new Error('Connect a Google workspace first, or switch back to mock preview.');
    }
    await new Promise((resolve) => setTimeout(resolve, 450));
    return markCreated(request.approvedActions ? responseFromApprovedActions(request) : parseBrainDump(request.text, request.requestId));
  }

  if (!settings.backendUrl) {
    throw new Error('Add the private Apps Script bridge URL in Settings first.');
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

function responseFromApprovedActions(request: BrainDumpRequest): BrainDumpResponse {
  const actions = request.approvedActions ?? [];
  return {
    ok: true,
    requestId: request.requestId,
    summary: {
      calendar: actions.filter((action) => action.type === 'calendar').length,
      workTasks: actions.filter((action) => action.type === 'work_task').length,
      personalTasks: actions.filter((action) => action.type === 'personal_task').length,
      projects: actions.filter((action) => action.type === 'project').length,
      waiting: actions.filter((action) => action.type === 'waiting').length,
      needsReview: actions.filter((action) => action.type === 'needs_review').length
    },
    actions,
    errors: []
  };
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
