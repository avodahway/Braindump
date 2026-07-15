import type { BackendSettings } from './client';
import {
  deletePublicAccountData,
  disconnectPublicGoogle,
  getPublicWorkspace,
  startPublicGoogleConnection
} from './publicClient';
import { connectDemoWorkspace, disconnectWorkspace } from './workspace';
import type { UserWorkspace } from '../lib/types';

export type BrowserLocation = {
  assign(url: string): void;
};

export async function connectPublicWorkspace(
  settings: BackendSettings,
  location: BrowserLocation = window.location
): Promise<UserWorkspace | undefined> {
  if (!settings.publicApiBaseUrl) {
    return connectDemoWorkspace();
  }

  const { authorizationUrl } = await startPublicGoogleConnection(settings.publicApiBaseUrl);
  location.assign(authorizationUrl);
  return undefined;
}

export async function disconnectPublicWorkspace(settings: BackendSettings): Promise<UserWorkspace> {
  if (settings.publicApiBaseUrl) {
    await disconnectPublicGoogle(settings.publicApiBaseUrl);
  }
  return disconnectWorkspace();
}

export async function deletePublicAccountRecords(settings: BackendSettings): Promise<UserWorkspace> {
  if (settings.publicApiBaseUrl) {
    await deletePublicAccountData(settings.publicApiBaseUrl);
  }
  return disconnectWorkspace();
}

export async function refreshPublicWorkspace(settings: BackendSettings): Promise<UserWorkspace | undefined> {
  if (!settings.publicApiBaseUrl) return undefined;
  return getPublicWorkspace(settings.publicApiBaseUrl);
}
