import type { BackendSettings } from './client';
import {
  deletePublicAccountData,
  disconnectPublicGoogle,
  getPublicBetaAccessStatus,
  getPublicWorkspace,
  redeemPublicBetaAccessCode,
  startPublicGoogleConnection
} from './publicClient';
import { connectDemoWorkspace, disconnectWorkspace } from './workspace';
import type { UserWorkspace } from '../lib/types';
import type { BetaAccessStatus } from './publicContract';

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

export async function refreshPublicBetaAccess(settings: BackendSettings): Promise<BetaAccessStatus | undefined> {
  if (!settings.publicApiBaseUrl) return undefined;
  return getPublicBetaAccessStatus(settings.publicApiBaseUrl);
}

export async function redeemPublicBetaAccess(settings: BackendSettings, code: string): Promise<BetaAccessStatus | undefined> {
  if (!settings.publicApiBaseUrl) return { required: false, granted: true };
  const response = await redeemPublicBetaAccessCode(settings.publicApiBaseUrl, code);
  return response.access;
}
