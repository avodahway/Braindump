import type { AnalyticsEvent, BrainDumpRequest, BrainDumpResponse, UserWorkspace } from '../lib/types';
import { publicBackendRoutes, type BetaAccessStatus } from './publicContract';

type JsonFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function normalizeApiBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export function publicApiUrl(baseUrl: string, route: string): string {
  const base = normalizeApiBaseUrl(baseUrl);
  if (!base) throw new Error('Add the public API URL in Settings first.');
  return `${base}${route}`;
}

export async function getPublicWorkspace(baseUrl: string, fetcher: JsonFetcher = fetch): Promise<UserWorkspace> {
  return readJson<UserWorkspace>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.workspace), {
      credentials: 'include'
    })
  );
}

export async function getPublicBetaAccessStatus(baseUrl: string, fetcher: JsonFetcher = fetch): Promise<BetaAccessStatus> {
  return readJson<BetaAccessStatus>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.betaStatus), {
      credentials: 'include'
    })
  );
}

export async function redeemPublicBetaAccessCode(
  baseUrl: string,
  code: string,
  fetcher: JsonFetcher = fetch
): Promise<{ ok: true; access: BetaAccessStatus }> {
  return readJson<{ ok: true; access: BetaAccessStatus }>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.betaAccess), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    })
  );
}

export async function startPublicGoogleConnection(
  baseUrl: string,
  fetcher: JsonFetcher = fetch
): Promise<{ authorizationUrl: string }> {
  return readJson<{ authorizationUrl: string }>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.googleConnect), {
      method: 'POST',
      credentials: 'include'
    })
  );
}

export async function disconnectPublicGoogle(baseUrl: string, fetcher: JsonFetcher = fetch): Promise<{ ok: true }> {
  return readJson<{ ok: true }>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.googleDisconnect), {
      method: 'POST',
      credentials: 'include'
    })
  );
}

export async function deletePublicAccountData(
  baseUrl: string,
  fetcher: JsonFetcher = fetch
): Promise<{ ok: true; deleted: string[] }> {
  return readJson<{ ok: true; deleted: string[] }>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.accountDelete), {
      method: 'POST',
      credentials: 'include'
    })
  );
}

export async function processPublicBrainDump(
  baseUrl: string,
  request: BrainDumpRequest,
  fetcher: JsonFetcher = fetch
): Promise<BrainDumpResponse> {
  return readJson<BrainDumpResponse>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.brainDump), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })
  );
}

export async function trackPublicEvent(
  baseUrl: string,
  event: AnalyticsEvent,
  fetcher: JsonFetcher = fetch
): Promise<{ ok: true }> {
  return readJson<{ ok: true }>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.events), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    })
  );
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await publicApiErrorMessage(response));
  }
  return response.json() as Promise<T>;
}

async function publicApiErrorMessage(response: Response): Promise<string> {
  const fallback = `Public API returned ${response.status}`;
  try {
    const body = (await response.json()) as { error?: unknown; errors?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
    if (Array.isArray(body.errors) && body.errors.every((error) => typeof error === 'string')) {
      return body.errors.join(' ');
    }
  } catch {
    return fallback;
  }
  return fallback;
}
