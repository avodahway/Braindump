import type { AnalyticsEvent, BrainDumpRequest, BrainDumpResponse, UserWorkspace } from '../lib/types';
import {
  publicBackendRoutes,
  type BetaAccessStatus,
  type BetaRequestInput,
  type BetaRequestRecord,
  type BetaRequestStatus,
  type DuplicateWriteAudit,
  type FeedbackInput,
  type FeedbackRecord,
  type FeedbackStatus,
  type LaunchSummary,
  type ProductionSelfTest,
  type SupportRequestInput,
  type SupportRequestRecord,
  type SupportRequestStatus
} from './publicContract';
import type { AnalyticsMetrics } from '../server/analyticsStore';
import type { BackupPlan } from '../server/backupPlan';
import type { ExecutionLogRecord } from '../server/executionLogStore';
import type { ReadinessReport } from '../server/readinessReport';

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

export async function submitPublicBetaRequest(
  baseUrl: string,
  request: BetaRequestInput,
  fetcher: JsonFetcher = fetch
): Promise<{ ok: true; request: BetaRequestRecord }> {
  return readJson<{ ok: true; request: BetaRequestRecord }>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.betaRequest), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })
  );
}

export async function submitPublicFeedback(
  baseUrl: string,
  feedback: FeedbackInput,
  fetcher: JsonFetcher = fetch
): Promise<{ ok: true; feedback: FeedbackRecord }> {
  return readJson<{ ok: true; feedback: FeedbackRecord }>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.feedback), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(feedback)
    })
  );
}

export async function submitPublicSupportRequest(
  baseUrl: string,
  request: SupportRequestInput,
  fetcher: JsonFetcher = fetch
): Promise<{ ok: true; supportRequest: SupportRequestRecord }> {
  return readJson<{ ok: true; supportRequest: SupportRequestRecord }>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.supportRequest), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
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

export async function getPublicAdminMetrics(
  baseUrl: string,
  adminToken: string,
  fetcher: JsonFetcher = fetch
): Promise<AnalyticsMetrics> {
  return readJson<AnalyticsMetrics>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.adminMetrics), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function getPublicAdminBackupPlan(
  baseUrl: string,
  adminToken: string,
  fetcher: JsonFetcher = fetch
): Promise<BackupPlan> {
  return readJson<BackupPlan>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.adminBackupPlan), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function getPublicAdminSelfTest(
  baseUrl: string,
  adminToken: string,
  fetcher: JsonFetcher = fetch
): Promise<ProductionSelfTest> {
  return readJson<ProductionSelfTest>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.adminSelfTest), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function getPublicAdminDuplicateWriteAudit(
  baseUrl: string,
  adminToken: string,
  fetcher: JsonFetcher = fetch
): Promise<DuplicateWriteAudit> {
  return readJson<DuplicateWriteAudit>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.adminDuplicateWriteAudit), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function getPublicAdminReadiness(
  baseUrl: string,
  adminToken: string,
  fetcher: JsonFetcher = fetch
): Promise<ReadinessReport> {
  return readJson<ReadinessReport>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.adminReadiness), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function getPublicAdminLaunchSummary(
  baseUrl: string,
  adminToken: string,
  fetcher: JsonFetcher = fetch
): Promise<LaunchSummary> {
  return readJson<LaunchSummary>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.adminLaunchSummary), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function getPublicAdminExecutionErrors(
  baseUrl: string,
  adminToken: string,
  fetcher: JsonFetcher = fetch
): Promise<{ recentErrors: ExecutionLogRecord[] }> {
  return readJson<{ recentErrors: ExecutionLogRecord[] }>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.adminExecutionErrors), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function getPublicAdminExecutionErrorsCsv(
  baseUrl: string,
  adminToken: string,
  fetcher: JsonFetcher = fetch
): Promise<string> {
  return readText(
    await fetcher(publicApiUrl(baseUrl, `${publicBackendRoutes.adminExecutionErrors}?format=csv`), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function getPublicAdminBetaRequests(
  baseUrl: string,
  adminToken: string,
  statusOrFetcher?: BetaRequestStatus | JsonFetcher,
  fetcher: JsonFetcher = fetch
): Promise<{ requests: BetaRequestRecord[] }> {
  const { status, fetcher: resolvedFetcher } = betaRequestArgs(statusOrFetcher, fetcher);
  return readJson<{ requests: BetaRequestRecord[] }>(
    await resolvedFetcher(publicApiUrl(baseUrl, adminBetaRequestsPath(status)), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function getPublicAdminBetaRequestsCsv(
  baseUrl: string,
  adminToken: string,
  statusOrFetcher?: BetaRequestStatus | JsonFetcher,
  fetcher: JsonFetcher = fetch
): Promise<string> {
  const { status, fetcher: resolvedFetcher } = betaRequestArgs(statusOrFetcher, fetcher);
  return readText(
    await resolvedFetcher(publicApiUrl(baseUrl, adminBetaRequestsPath(status, 'csv')), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function updatePublicAdminBetaRequestStatus(
  baseUrl: string,
  adminToken: string,
  id: string,
  status: BetaRequestStatus,
  fetcher: JsonFetcher = fetch
): Promise<{ ok: true; request: BetaRequestRecord }> {
  return readJson<{ ok: true; request: BetaRequestRecord }>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.adminBetaRequest), {
      method: 'POST',
      headers: {
        ...adminHeaders(adminToken),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id, status })
    })
  );
}

export async function getPublicAdminFeedback(
  baseUrl: string,
  adminToken: string,
  statusOrFetcher?: FeedbackStatus | JsonFetcher,
  fetcher: JsonFetcher = fetch
): Promise<{ feedback: FeedbackRecord[] }> {
  const { status, fetcher: resolvedFetcher } = feedbackArgs(statusOrFetcher, fetcher);
  return readJson<{ feedback: FeedbackRecord[] }>(
    await resolvedFetcher(publicApiUrl(baseUrl, adminFeedbackPath(status)), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function getPublicAdminFeedbackCsv(
  baseUrl: string,
  adminToken: string,
  statusOrFetcher?: FeedbackStatus | JsonFetcher,
  fetcher: JsonFetcher = fetch
): Promise<string> {
  const { status, fetcher: resolvedFetcher } = feedbackArgs(statusOrFetcher, fetcher);
  return readText(
    await resolvedFetcher(publicApiUrl(baseUrl, adminFeedbackPath(status, 'csv')), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function updatePublicAdminFeedbackStatus(
  baseUrl: string,
  adminToken: string,
  id: string,
  status: FeedbackStatus,
  fetcher: JsonFetcher = fetch
): Promise<{ ok: true; feedback: FeedbackRecord }> {
  return readJson<{ ok: true; feedback: FeedbackRecord }>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.adminFeedbackItem), {
      method: 'POST',
      headers: {
        ...adminHeaders(adminToken),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id, status })
    })
  );
}

export async function getPublicAdminSupportRequests(
  baseUrl: string,
  adminToken: string,
  statusOrFetcher?: SupportRequestStatus | JsonFetcher,
  fetcher: JsonFetcher = fetch
): Promise<{ supportRequests: SupportRequestRecord[] }> {
  const { status, fetcher: resolvedFetcher } = supportRequestArgs(statusOrFetcher, fetcher);
  return readJson<{ supportRequests: SupportRequestRecord[] }>(
    await resolvedFetcher(publicApiUrl(baseUrl, adminSupportRequestsPath(status)), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function getPublicAdminSupportRequestsCsv(
  baseUrl: string,
  adminToken: string,
  statusOrFetcher?: SupportRequestStatus | JsonFetcher,
  fetcher: JsonFetcher = fetch
): Promise<string> {
  const { status, fetcher: resolvedFetcher } = supportRequestArgs(statusOrFetcher, fetcher);
  return readText(
    await resolvedFetcher(publicApiUrl(baseUrl, adminSupportRequestsPath(status, 'csv')), {
      headers: adminHeaders(adminToken)
    })
  );
}

export async function updatePublicAdminSupportRequestStatus(
  baseUrl: string,
  adminToken: string,
  id: string,
  status: SupportRequestStatus,
  fetcher: JsonFetcher = fetch
): Promise<{ ok: true; supportRequest: SupportRequestRecord }> {
  return readJson<{ ok: true; supportRequest: SupportRequestRecord }>(
    await fetcher(publicApiUrl(baseUrl, publicBackendRoutes.adminSupportRequest), {
      method: 'POST',
      headers: {
        ...adminHeaders(adminToken),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id, status })
    })
  );
}

function adminHeaders(adminToken: string): HeadersInit {
  return {
    'X-Brain-Dump-Admin-Token': adminToken
  };
}

function adminBetaRequestsPath(status?: BetaRequestStatus, format?: 'csv'): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (format) params.set('format', format);
  const query = params.toString();
  return query ? `${publicBackendRoutes.adminBetaRequests}?${query}` : publicBackendRoutes.adminBetaRequests;
}

function betaRequestArgs(
  statusOrFetcher: BetaRequestStatus | JsonFetcher | undefined,
  fetcher: JsonFetcher
): { status?: BetaRequestStatus; fetcher: JsonFetcher } {
  return typeof statusOrFetcher === 'function'
    ? { fetcher: statusOrFetcher }
    : { status: statusOrFetcher, fetcher };
}

function adminFeedbackPath(status?: FeedbackStatus, format?: 'csv'): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (format) params.set('format', format);
  const query = params.toString();
  return query ? `${publicBackendRoutes.adminFeedback}?${query}` : publicBackendRoutes.adminFeedback;
}

function feedbackArgs(
  statusOrFetcher: FeedbackStatus | JsonFetcher | undefined,
  fetcher: JsonFetcher
): { status?: FeedbackStatus; fetcher: JsonFetcher } {
  return typeof statusOrFetcher === 'function'
    ? { fetcher: statusOrFetcher }
    : { status: statusOrFetcher, fetcher };
}

function adminSupportRequestsPath(status?: SupportRequestStatus, format?: 'csv'): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (format) params.set('format', format);
  const query = params.toString();
  return query ? `${publicBackendRoutes.adminSupportRequests}?${query}` : publicBackendRoutes.adminSupportRequests;
}

function supportRequestArgs(
  statusOrFetcher: SupportRequestStatus | JsonFetcher | undefined,
  fetcher: JsonFetcher
): { status?: SupportRequestStatus; fetcher: JsonFetcher } {
  return typeof statusOrFetcher === 'function'
    ? { fetcher: statusOrFetcher }
    : { status: statusOrFetcher, fetcher };
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await publicApiErrorMessage(response));
  }
  return response.json() as Promise<T>;
}

async function readText(response: Response): Promise<string> {
  if (!response.ok) {
    throw new Error(await publicApiErrorMessage(response));
  }
  return response.text();
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
