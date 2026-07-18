import { parseBrainDump } from '../lib/parser';
import type { ActionType, BrainDumpRequest, BrainDumpResponse, ParsedAction, UserWorkspace } from '../lib/types';
import {
  publicBackendRoutes,
  type BetaRequestInput,
  type BetaRequestRecord,
  type BetaRequestStatus,
  type FeedbackInput,
  type FeedbackRecord,
  type FeedbackStatus,
  type LaunchSummary,
  type SupportRequestInput,
  type SupportRequestRecord,
  type SupportRequestStatus
} from '../api/publicContract';
import { createDemoActionExecutor, type ActionExecutor } from './actionExecutor';
import {
  completeOAuthSession,
  createMemoryOAuthStore,
  startOAuthSession,
  type OAuthSessionStore,
  type TokenExchangeClient,
  type WorkspaceProvisioner
} from './oauthSession';
import {
  clearSessionCookie,
  createMemorySessionStore,
  readSessionIdFromCookie,
  sessionCookie,
  type SessionStore
} from './sessionStore';
import { createMemoryResponseStore, type ResponseStore } from './idempotencyStore';
import { createMemoryExecutionLogStore, type ExecutionLogRecord, type ExecutionLogStore } from './executionLogStore';
import { createMemoryAnalyticsStore, sanitizeAnalyticsEvent, summarizeAnalytics, type AnalyticsStore } from './analyticsStore';
import { createMemoryBetaRequestStore, type BetaRequestStore } from './betaRequestStore';
import { createMemoryFeedbackStore, type FeedbackStore } from './feedbackStore';
import { createMemorySupportRequestStore, type SupportRequestStore } from './supportRequestStore';
import { buildBackupPlan } from './backupPlan';
import { buildReadinessReport } from './readinessReport';
import { buildProductionSelfTest } from './productionSelfTest';

export type GoogleOAuthConfig = {
  clientId: string;
  redirectUri: string;
  scopes: string[];
};

export type PublicBackendOptions = {
  googleOAuth: GoogleOAuthConfig;
  frontendAppUrl?: string;
  workspace?: UserWorkspace;
  executor?: ActionExecutor;
  oauthStore?: OAuthSessionStore;
  tokenClient?: TokenExchangeClient;
  workspaceProvisioner?: WorkspaceProvisioner;
  sessionStore?: SessionStore;
  responseStore?: ResponseStore;
  executionLogStore?: ExecutionLogStore;
  analyticsStore?: AnalyticsStore;
  betaRequestStore?: BetaRequestStore;
  feedbackStore?: FeedbackStore;
  supportRequestStore?: SupportRequestStore;
  adminToken?: string;
  storageKeyPrefix?: string;
  storageMode?: 'memory' | 'durable';
  storageEncrypted?: boolean;
  betaAccessCode?: string;
  requestLimits?: PublicRequestLimits;
  now?: () => Date;
};

export type PublicRequestLimits = {
  maxJsonBodyBytes?: number;
  rateLimit?: PublicRateLimitOptions | false;
};

export type PublicRateLimitOptions = {
  windowMs?: number;
  maxRequests?: number;
};

const defaultMaxJsonBodyBytes = 64 * 1024;
const defaultRateLimit = {
  windowMs: 60 * 1000,
  maxRequests: 60
};

const rateLimitedPaths = new Set<string>([
  publicBackendRoutes.betaAccess,
  publicBackendRoutes.betaRequest,
  publicBackendRoutes.brainDump,
  publicBackendRoutes.events,
  publicBackendRoutes.feedback,
  publicBackendRoutes.supportRequest,
  publicBackendRoutes.googleConnect,
  publicBackendRoutes.googleDisconnect,
  publicBackendRoutes.accountDelete
]);

const betaProtectedPaths = new Set<string>([publicBackendRoutes.brainDump, publicBackendRoutes.googleConnect]);
const betaAccessCookieName = 'bd_beta_access';

export function createPublicBackend(options: PublicBackendOptions) {
  let fallbackWorkspace = options.workspace;
  const executor = options.executor ?? createDemoActionExecutor();
  const oauthStore = options.oauthStore ?? createMemoryOAuthStore();
  const sessionStore = options.sessionStore ?? createMemorySessionStore();
  const responseStore = options.responseStore ?? createMemoryResponseStore();
  const executionLogStore = options.executionLogStore ?? createMemoryExecutionLogStore();
  const analyticsStore = options.analyticsStore ?? createMemoryAnalyticsStore();
  const betaRequestStore = options.betaRequestStore ?? createMemoryBetaRequestStore();
  const feedbackStore = options.feedbackStore ?? createMemoryFeedbackStore();
  const supportRequestStore = options.supportRequestStore ?? createMemorySupportRequestStore();
  const now = options.now ?? (() => new Date());
  const maxJsonBodyBytes = options.requestLimits?.maxJsonBodyBytes ?? defaultMaxJsonBodyBytes;
  const rateLimitMaxRequests =
    options.requestLimits?.rateLimit === false ? undefined : options.requestLimits?.rateLimit?.maxRequests ?? defaultRateLimit.maxRequests;
  const rateLimiter = createRateLimiter(options.requestLimits?.rateLimit, now);
  const betaAccessCode = options.betaAccessCode?.trim();

  return {
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const sendJson = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
        withCors(json(value, status, headers), request, options.frontendAppUrl);
      const sendRedirect = (location: string, headers: Record<string, string> = {}) =>
        withCors(redirect(location, headers), request, options.frontendAppUrl);

      if (request.method === 'OPTIONS') {
        return corsPreflight(request, options.frontendAppUrl);
      }

      const originError = requireAllowedOrigin(request, options.frontendAppUrl);
      if (originError) return originError;

      const rateLimitResult = rateLimiter?.check(request, url.pathname);
      if (rateLimitResult && !rateLimitResult.ok) {
        return sendJson(
          { error: 'Too many requests. Please try again shortly.' },
          429,
          rateLimitHeaders(rateLimitResult)
        );
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.health) {
        return sendJson({
          ok: true,
          service: 'brain-dump-public-backend',
          time: now().toISOString()
        });
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.betaStatus) {
        return sendJson(await betaAccessStatus(request, betaAccessCode));
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.betaAccess) {
        if (!betaAccessCode) return sendJson({ ok: true, access: { required: false, granted: true } });

        const body = await readJsonBody(request, maxJsonBodyBytes);
        if (!body.ok) return sendJson({ error: body.error }, body.status);

        const code = parseBetaAccessCode(body.value);
        if (!code) return sendJson({ error: 'Beta access code is required.' }, 400);
        if (!timingSafeEqualText(code, betaAccessCode)) return sendJson({ error: 'Beta access code is invalid.' }, 403);

        return sendJson(
          { ok: true, access: { required: true, granted: true } },
          200,
          { 'Set-Cookie': betaAccessCookie(await betaAccessCookieValue(betaAccessCode)) }
        );
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.betaRequest) {
        const body = await readJsonBody(request, maxJsonBodyBytes);
        if (!body.ok) return sendJson({ error: body.error }, body.status);

        const parsedRequest = parseBetaRequest(body.value);
        if (!parsedRequest.ok) return sendJson({ error: parsedRequest.error }, 400);

        const record = {
          ...parsedRequest.value,
          id: crypto.randomUUID(),
          status: 'new' as const,
          createdAt: now().toISOString()
        };
        await betaRequestStore.append(record);
        return sendJson({ ok: true, request: record });
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.feedback) {
        const body = await readJsonBody(request, maxJsonBodyBytes);
        if (!body.ok) return sendJson({ error: body.error }, body.status);

        const parsedFeedback = parseFeedback(body.value);
        if (!parsedFeedback.ok) return sendJson({ error: parsedFeedback.error }, 400);

        const record = {
          ...parsedFeedback.value,
          id: crypto.randomUUID(),
          status: 'new' as const,
          createdAt: now().toISOString()
        };
        await feedbackStore.append(record);
        return sendJson({ ok: true, feedback: record });
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.supportRequest) {
        const body = await readJsonBody(request, maxJsonBodyBytes);
        if (!body.ok) return sendJson({ error: body.error }, body.status);
        const parsedSupportRequest = parseSupportRequest(body.value);
        if (!parsedSupportRequest.ok) return sendJson({ error: parsedSupportRequest.error }, 400);
        const record = {
          ...parsedSupportRequest.value,
          id: crypto.randomUUID(),
          status: 'new' as const,
          createdAt: now().toISOString()
        };
        await supportRequestStore.append(record);
        return sendJson({ ok: true, supportRequest: record });
      }

      const betaError = await requireBetaAccess(request, url.pathname, betaAccessCode);
      if (betaError) return sendJson({ error: betaError }, 403);

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.workspace) {
        return sendJson((await readRequestWorkspace(request, sessionStore, oauthStore))?.workspace ?? fallbackWorkspace ?? disconnectedWorkspace());
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.googleConnect) {
        return sendJson(await startOAuthSession(options.googleOAuth, oauthStore));
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.googleCallback) {
        if (!options.tokenClient) {
          return sendJson({ error: 'OAuth token client is not configured.' }, 501);
        }

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code || !state) {
          return sendJson({ error: 'Missing OAuth code or state.' }, 400);
        }

        try {
          const workspace = await completeOAuthSession({
            code,
            state,
            store: oauthStore,
            tokenClient: options.tokenClient,
            workspaceProvisioner: options.workspaceProvisioner
          });
          const session = await sessionStore.createSession(workspace.email?.toLowerCase() ?? '');
          if (options.frontendAppUrl) {
            return sendRedirect(callbackReturnUrl(options.frontendAppUrl, { connected: 'google' }), {
              'Set-Cookie': sessionCookie(session.id)
            });
          }
          return sendJson(workspace, 200, { 'Set-Cookie': sessionCookie(session.id) });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'OAuth callback failed.';
          if (options.frontendAppUrl) {
            return sendRedirect(callbackReturnUrl(options.frontendAppUrl, { connection: 'error', reason: message }));
          }
          return sendJson({ error: message }, 400);
        }
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.googleDisconnect) {
        const session = await readRequestSession(request, sessionStore);
        if (session) {
          await oauthStore.deleteConnection(session.userId);
          await sessionStore.deleteSession(session.id);
        }
        fallbackWorkspace = undefined;
        return sendJson({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.accountDelete) {
        const session = await readRequestSession(request, sessionStore);
        if (!session) return sendJson({ error: 'Not signed in.' }, 401);

        await deleteUserRecords(session.userId, {
          oauthStore,
          sessionStore,
          responseStore,
          executionLogStore,
          analyticsStore,
          sessionId: session.id
        });
        fallbackWorkspace = undefined;
        return sendJson(
          {
            ok: true,
            deleted: ['google_tokens', 'workspace', 'session', 'idempotency_responses', 'execution_logs', 'analytics_events']
          },
          200,
          { 'Set-Cookie': clearSessionCookie() }
        );
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.events) {
        const body = await readJsonBody(request, maxJsonBodyBytes);
        if (!body.ok) return sendJson({ error: body.error }, body.status);

        const event = sanitizeAnalyticsEvent(body.value);
        if (!event) return sendJson({ error: 'Invalid analytics event.' }, 400);
        const session = await readRequestSession(request, sessionStore);
        await analyticsStore.append({
          ...event,
          userId: session?.userId,
          createdAt: now().toISOString()
        });
        return sendJson({ ok: true });
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.adminMetrics) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin metrics are not configured.');
        if (adminError) return withCors(adminError, request, options.frontendAppUrl);
        return sendJson(summarizeAnalytics(await analyticsStore.readAll()));
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.adminBackupPlan) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin backup plan is not configured.');
        if (adminError) return withCors(adminError, request, options.frontendAppUrl);
        return sendJson(
          buildBackupPlan({
            storagePrefix: options.storageKeyPrefix,
            generatedAt: now().toISOString()
          })
        );
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.adminSelfTest) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin self-test is not configured.');
        if (adminError) return withCors(adminError, request, options.frontendAppUrl);
        const readiness = buildReadinessReport({
          generatedAt: now().toISOString(),
          googleClientId: options.googleOAuth.clientId,
          googleRedirectUri: options.googleOAuth.redirectUri,
          googleScopes: options.googleOAuth.scopes,
          frontendAppUrl: options.frontendAppUrl,
          adminTokenConfigured: Boolean(options.adminToken),
          storageMode: options.storageMode ?? 'memory',
          storageEncrypted: Boolean(options.storageEncrypted)
        });
        return sendJson(
          buildProductionSelfTest({
            generatedAt: readiness.generatedAt,
            readiness,
            frontendAppUrl: options.frontendAppUrl,
            storageMode: options.storageMode ?? 'memory',
            storageEncrypted: Boolean(options.storageEncrypted),
            betaAccessConfigured: Boolean(options.betaAccessCode),
            maxJsonBodyBytes,
            rateLimitMaxRequests
          })
        );
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.adminReadiness) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin readiness is not configured.');
        if (adminError) return withCors(adminError, request, options.frontendAppUrl);
        return sendJson(
          buildReadinessReport({
            generatedAt: now().toISOString(),
            googleClientId: options.googleOAuth.clientId,
            googleRedirectUri: options.googleOAuth.redirectUri,
            googleScopes: options.googleOAuth.scopes,
            frontendAppUrl: options.frontendAppUrl,
            adminTokenConfigured: Boolean(options.adminToken),
            storageMode: options.storageMode ?? 'memory',
            storageEncrypted: Boolean(options.storageEncrypted)
          })
        );
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.adminLaunchSummary) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin launch summary is not configured.');
        if (adminError) return withCors(adminError, request, options.frontendAppUrl);
        return sendJson(await buildLaunchSummary({
          generatedAt: now().toISOString(),
          analyticsStore,
          betaRequestStore,
          feedbackStore,
          supportRequestStore,
          executionLogStore,
          ready: buildReadinessReport({
            generatedAt: now().toISOString(),
            googleClientId: options.googleOAuth.clientId,
            googleRedirectUri: options.googleOAuth.redirectUri,
            googleScopes: options.googleOAuth.scopes,
            frontendAppUrl: options.frontendAppUrl,
            adminTokenConfigured: Boolean(options.adminToken),
            storageMode: options.storageMode ?? 'memory',
            storageEncrypted: Boolean(options.storageEncrypted)
          }).ready
        }));
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.adminExecutionErrors) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin execution errors are not configured.');
        if (adminError) return withCors(adminError, request, options.frontendAppUrl);
        const recentErrors = await executionLogStore.readRecentErrors(parseAdminLimit(url.searchParams.get('limit')));
        if (url.searchParams.get('format') === 'csv') {
          return withCors(csv(executionErrorsCsv(recentErrors), 'brain-dump-execution-errors.csv'), request, options.frontendAppUrl);
        }
        return sendJson({
          recentErrors
        });
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.adminBetaRequests) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin beta requests are not configured.');
        if (adminError) return withCors(adminError, request, options.frontendAppUrl);
        const status = parseBetaRequestStatusFilter(url.searchParams.get('status'));
        if (!status.ok) return sendJson({ error: status.error }, 400);
        const requests = (await betaRequestStore.readRecent(parseAdminLimit(url.searchParams.get('limit')))).filter((request) =>
          status.value ? request.status === status.value : true
        );
        if (url.searchParams.get('format') === 'csv') {
          return withCors(csv(betaRequestsCsv(requests), 'brain-dump-beta-requests.csv'), request, options.frontendAppUrl);
        }
        return sendJson({
          requests
        });
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.adminBetaRequest) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin beta request updates are not configured.');
        if (adminError) return withCors(adminError, request, options.frontendAppUrl);
        const body = await readJsonBody(request, maxJsonBodyBytes);
        if (!body.ok) return sendJson({ error: body.error }, body.status);
        const update = parseBetaRequestStatusUpdate(body.value);
        if (!update.ok) return sendJson({ error: update.error }, 400);
        const record = await betaRequestStore.updateStatus(update.value.id, update.value.status, now().toISOString());
        if (!record) return sendJson({ error: 'Beta request was not found.' }, 404);
        return sendJson({ ok: true, request: record });
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.adminFeedback) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin feedback is not configured.');
        if (adminError) return withCors(adminError, request, options.frontendAppUrl);
        const status = parseFeedbackStatusFilter(url.searchParams.get('status'));
        if (!status.ok) return sendJson({ error: status.error }, 400);
        const feedback = (await feedbackStore.readRecent(parseAdminLimit(url.searchParams.get('limit')))).filter((record) =>
          status.value ? record.status === status.value : true
        );
        if (url.searchParams.get('format') === 'csv') {
          return withCors(csv(feedbackCsv(feedback), 'brain-dump-feedback.csv'), request, options.frontendAppUrl);
        }
        return sendJson({
          feedback
        });
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.adminFeedbackItem) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin feedback updates are not configured.');
        if (adminError) return withCors(adminError, request, options.frontendAppUrl);
        const body = await readJsonBody(request, maxJsonBodyBytes);
        if (!body.ok) return sendJson({ error: body.error }, body.status);
        const update = parseFeedbackStatusUpdate(body.value);
        if (!update.ok) return sendJson({ error: update.error }, 400);
        const record = await feedbackStore.updateStatus(update.value.id, update.value.status, now().toISOString());
        if (!record) return sendJson({ error: 'Feedback was not found.' }, 404);
        return sendJson({ ok: true, feedback: record });
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.adminSupportRequests) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin support requests are not configured.');
        if (adminError) return withCors(adminError, request, options.frontendAppUrl);
        const status = parseSupportRequestStatusFilter(url.searchParams.get('status'));
        if (!status.ok) return sendJson({ error: status.error }, 400);
        const supportRequests = (await supportRequestStore.readRecent(parseAdminLimit(url.searchParams.get('limit')))).filter((request) =>
          status.value ? request.status === status.value : true
        );
        if (url.searchParams.get('format') === 'csv') {
          return withCors(csv(supportRequestsCsv(supportRequests), 'brain-dump-support-requests.csv'), request, options.frontendAppUrl);
        }
        return sendJson({
          supportRequests
        });
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.adminSupportRequest) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin support request updates are not configured.');
        if (adminError) return withCors(adminError, request, options.frontendAppUrl);
        const body = await readJsonBody(request, maxJsonBodyBytes);
        if (!body.ok) return sendJson({ error: body.error }, body.status);
        const update = parseSupportRequestStatusUpdate(body.value);
        if (!update.ok) return sendJson({ error: update.error }, 400);
        const record = await supportRequestStore.updateStatus(update.value.id, update.value.status, now().toISOString());
        if (!record) return sendJson({ error: 'Support request was not found.' }, 404);
        return sendJson({ ok: true, supportRequest: record });
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.brainDump) {
        const requestWorkspace = await readRequestWorkspace(request, sessionStore, oauthStore);
        const workspace = requestWorkspace?.workspace ?? fallbackWorkspace ?? disconnectedWorkspace();
        if (workspace.status !== 'connected') {
          return sendJson({ error: 'Google workspace is not connected.' }, 409);
        }

        const parsedJson = await readJsonBody(request, maxJsonBodyBytes);
        if (!parsedJson.ok) return sendJson({ error: parsedJson.error }, parsedJson.status);

        const parsedRequest = parseBrainDumpRequest(parsedJson.value);
        if (!parsedRequest.ok) return sendJson({ error: parsedRequest.error }, 400);

        const body = parsedRequest.value;
        const savedResponse = await responseStore.readResponse(body.requestId);
        if (savedResponse) {
          return sendJson(savedResponse);
        }

        const response = await executeParsedResponse(
          body.approvedActions ? responseFromApprovedActions(body) : parseBrainDump(body.text, body.requestId),
          workspace,
          executor,
          body,
          requestWorkspace?.userId,
          executionLogStore,
          now
        );
        await responseStore.saveResponse(body.requestId, response, requestWorkspace?.userId);
        return sendJson(response);
      }

      return sendJson({ error: 'Not found' }, 404);
    }
  };
}

async function betaAccessStatus(request: Request, betaAccessCode: string | undefined) {
  if (!betaAccessCode) return { required: false, granted: true };
  return {
    required: true,
    granted: await hasBetaAccess(request, betaAccessCode)
  };
}

async function requireBetaAccess(request: Request, pathname: string, betaAccessCode: string | undefined): Promise<string | undefined> {
  if (!betaAccessCode || request.method !== 'POST' || !betaProtectedPaths.has(pathname)) return undefined;
  return (await hasBetaAccess(request, betaAccessCode)) ? undefined : 'Beta access code is required.';
}

async function hasBetaAccess(request: Request, betaAccessCode: string): Promise<boolean> {
  const cookieValue = readCookie(request.headers.get('Cookie'), betaAccessCookieName);
  if (!cookieValue) return false;
  return timingSafeEqualText(cookieValue, await betaAccessCookieValue(betaAccessCode));
}

function parseBetaAccessCode(value: unknown): string | undefined {
  return isRecord(value) && isNonEmptyString(value.code) ? value.code.trim() : undefined;
}

function parseBetaRequest(value: unknown): { ok: true; value: BetaRequestInput } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: 'Beta request must be an object.' };

  const name = trimmedString(value.name);
  const email = trimmedString(value.email);
  const tools = trimmedString(value.tools);
  const googleComfort = trimmedString(value.googleComfort);
  const notes = trimmedString(value.notes);

  if (!name) return { ok: false, error: 'Name is required.' };
  if (!email || !email.includes('@')) return { ok: false, error: 'A valid email is required.' };
  if (!tools) return { ok: false, error: 'Current task or calendar tools are required.' };
  if (!googleComfort) return { ok: false, error: 'Google connection comfort is required.' };

  return {
    ok: true,
    value: {
      name,
      email: email.toLowerCase(),
      tools,
      googleComfort,
      ...(notes ? { notes } : {})
    }
  };
}

function parseFeedback(value: unknown): { ok: true; value: FeedbackInput } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: 'Feedback must be an object.' };

  const email = trimmedString(value.email);
  const requestId = trimmedString(value.requestId);
  const lookedRight = trimmedString(value.lookedRight);
  const confusing = trimmedString(value.confusing);
  const expected = trimmedString(value.expected);

  if (email && !email.includes('@')) return { ok: false, error: 'Feedback email must be valid.' };
  if (!lookedRight) return { ok: false, error: 'What looked right is required.' };
  if (!confusing) return { ok: false, error: 'What looked wrong or confusing is required.' };
  if (!expected) return { ok: false, error: 'What you expected is required.' };

  return {
    ok: true,
    value: {
      ...(email ? { email: email.toLowerCase() } : {}),
      ...(requestId ? { requestId } : {}),
      lookedRight,
      confusing,
      expected
    }
  };
}

function parseSupportRequest(value: unknown): { ok: true; value: SupportRequestInput } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: 'Support request must be an object.' };
  const email = trimmedString(value.email);
  const issueType = trimmedString(value.issueType);
  const summary = trimmedString(value.summary);
  const details = trimmedString(value.details);
  if (!email || !email.includes('@')) return { ok: false, error: 'A valid email is required.' };
  if (!issueType) return { ok: false, error: 'Issue type is required.' };
  if (!summary) return { ok: false, error: 'Summary is required.' };
  if (!details) return { ok: false, error: 'Details are required.' };
  return {
    ok: true,
    value: {
      email: email.toLowerCase(),
      issueType,
      summary,
      details
    }
  };
}

function parseBetaRequestStatusUpdate(
  value: unknown
): { ok: true; value: { id: string; status: BetaRequestStatus } } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: 'Beta request update must be an object.' };
  const id = trimmedString(value.id);
  if (!id) return { ok: false, error: 'Beta request id is required.' };
  if (!isBetaRequestStatus(value.status)) return { ok: false, error: 'Beta request status is invalid.' };
  return { ok: true, value: { id, status: value.status } };
}

function isBetaRequestStatus(value: unknown): value is BetaRequestStatus {
  return value === 'new' || value === 'invited' || value === 'archived';
}

function parseFeedbackStatusUpdate(
  value: unknown
): { ok: true; value: { id: string; status: FeedbackStatus } } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: 'Feedback update must be an object.' };
  const id = trimmedString(value.id);
  if (!id) return { ok: false, error: 'Feedback id is required.' };
  if (!isFeedbackStatus(value.status)) return { ok: false, error: 'Feedback status is invalid.' };
  return { ok: true, value: { id, status: value.status } };
}

function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return value === 'new' || value === 'reviewed' || value === 'archived';
}

function parseSupportRequestStatusUpdate(
  value: unknown
): { ok: true; value: { id: string; status: SupportRequestStatus } } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: 'Support request update must be an object.' };
  const id = trimmedString(value.id);
  if (!id) return { ok: false, error: 'Support request id is required.' };
  if (!isSupportRequestStatus(value.status)) return { ok: false, error: 'Support request status is invalid.' };
  return { ok: true, value: { id, status: value.status } };
}

function isSupportRequestStatus(value: unknown): value is SupportRequestStatus {
  return value === 'new' || value === 'in_progress' || value === 'resolved' || value === 'archived';
}

async function betaAccessCookieValue(betaAccessCode: string): Promise<string> {
  const bytes = new TextEncoder().encode(`brain-dump-beta-access:${betaAccessCode}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function betaAccessCookie(value: string): string {
  return `${betaAccessCookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000`;
}

function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .map((part) => part.split('='))
    .find(([cookieName]) => cookieName === name)?.[1];
}

function timingSafeEqualText(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

type JsonReadResult = { ok: true; value: unknown } | { ok: false; error: string; status: number };

async function readJsonBody(request: Request, maxBodyBytes: number): Promise<JsonReadResult> {
  if (contentLengthExceedsLimit(request, maxBodyBytes)) {
    return { ok: false, error: 'Request body is too large.', status: 413 };
  }

  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > maxBodyBytes) {
      return { ok: false, error: 'Request body is too large.', status: 413 };
    }
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return { ok: false, error: 'Invalid JSON body.', status: 400 };
  }
}

function contentLengthExceedsLimit(request: Request, maxBodyBytes: number): boolean {
  const contentLength = request.headers.get('Content-Length');
  if (!contentLength) return false;

  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > maxBodyBytes;
}

type RateLimitCheck =
  | { ok: true }
  | {
      ok: false;
      limit: number;
      remaining: number;
      resetAt: number;
      retryAfterSeconds: number;
    };

function createRateLimiter(rateLimit: PublicRateLimitOptions | false | undefined, now: () => Date) {
  if (rateLimit === false) return undefined;

  const windowMs = rateLimit?.windowMs ?? defaultRateLimit.windowMs;
  const maxRequests = rateLimit?.maxRequests ?? defaultRateLimit.maxRequests;
  const buckets = new Map<string, { resetAt: number; count: number }>();

  return {
    check(request: Request, pathname: string): RateLimitCheck {
      if (request.method !== 'POST' || !rateLimitedPaths.has(pathname)) return { ok: true };

      const key = `${clientIdentity(request)}:${pathname}`;
      const timestamp = now().getTime();
      const current = buckets.get(key);
      const bucket = !current || timestamp >= current.resetAt ? { resetAt: timestamp + windowMs, count: 0 } : current;

      if (bucket.count >= maxRequests) {
        buckets.set(key, bucket);
        return {
          ok: false,
          limit: maxRequests,
          remaining: 0,
          resetAt: bucket.resetAt,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - timestamp) / 1000))
        };
      }

      bucket.count += 1;
      buckets.set(key, bucket);
      return { ok: true };
    }
  };
}

function clientIdentity(request: Request): string {
  const sessionId = readSessionIdFromCookie(request.headers.get('Cookie'));
  if (sessionId) return `session:${sessionId}`;

  const forwardedFor = request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim();
  const ip = forwardedFor || request.headers.get('CF-Connecting-IP') || request.headers.get('X-Real-IP');
  return `ip:${ip || 'anonymous'}`;
}

function rateLimitHeaders(result: Extract<RateLimitCheck, { ok: false }>): Record<string, string> {
  return {
    'Retry-After': String(result.retryAfterSeconds),
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000))
  };
}

type BrainDumpRequestResult = { ok: true; value: BrainDumpRequest } | { ok: false; error: string };

const validActionTypes = new Set<ActionType>(['calendar', 'work_task', 'personal_task', 'project', 'waiting', 'needs_review', 'error']);
const validActionStatuses = new Set<NonNullable<ParsedAction['status']>>(['planned', 'created', 'needs_review', 'error']);

function parseBrainDumpRequest(value: unknown): BrainDumpRequestResult {
  if (!isRecord(value)) return { ok: false, error: 'Brain dump request must be an object.' };

  if (!isNonEmptyString(value.requestId)) return { ok: false, error: 'Brain dump requestId is required.' };
  if (!isNonEmptyString(value.text)) return { ok: false, error: 'Brain dump text is required.' };
  if (!isNonEmptyString(value.timezone)) return { ok: false, error: 'Brain dump timezone is required.' };

  const request: BrainDumpRequest = {
    requestId: value.requestId,
    text: value.text,
    timezone: value.timezone
  };

  if (value.approvedActions !== undefined) {
    if (!Array.isArray(value.approvedActions)) return { ok: false, error: 'Approved actions must be an array.' };
    const actions = value.approvedActions.map(parseApprovedAction);
    const invalidAction = actions.find((action): action is { ok: false; error: string } => !action.ok);
    if (invalidAction) return { ok: false, error: invalidAction.error };
    request.approvedActions = actions.filter(isValidParsedActionResult).map((action) => action.value);
  }

  return { ok: true, value: request };
}

function parseApprovedAction(value: unknown): { ok: true; value: ParsedAction } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: 'Approved actions must contain action objects.' };
  if (!isNonEmptyString(value.type) || !validActionTypes.has(value.type as ActionType)) {
    return { ok: false, error: 'Approved action type is invalid.' };
  }
  if (!isNonEmptyString(value.title)) return { ok: false, error: 'Approved action title is required.' };
  if (!isNonEmptyString(value.sourceText)) return { ok: false, error: 'Approved action sourceText is required.' };
  if (value.status !== undefined && (!isNonEmptyString(value.status) || !isValidActionStatus(value.status))) {
    return { ok: false, error: 'Approved action status is invalid.' };
  }

  return {
    ok: true,
    value: {
      type: value.type as ActionType,
      title: value.title,
      status: isValidActionStatus(value.status) ? value.status : undefined,
      notes: optionalString(value.notes),
      dueDate: optionalString(value.dueDate),
      calendarDate: optionalString(value.calendarDate),
      startTime: optionalString(value.startTime),
      durationMinutes: optionalNumber(value.durationMinutes),
      hours: optionalNumber(value.hours),
      sourceText: value.sourceText
    }
  };
}

function isValidParsedActionResult(
  value: { ok: true; value: ParsedAction } | { ok: false; error: string }
): value is { ok: true; value: ParsedAction } {
  return value.ok;
}

function isValidActionStatus(value: unknown): value is NonNullable<ParsedAction['status']> {
  return isNonEmptyString(value) && validActionStatuses.has(value as NonNullable<ParsedAction['status']>);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function trimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

async function deleteUserRecords(
  userId: string,
  {
    oauthStore,
    sessionStore,
    responseStore,
    executionLogStore,
    analyticsStore,
    sessionId
  }: {
    oauthStore: OAuthSessionStore;
    sessionStore: SessionStore;
    responseStore: ResponseStore;
    executionLogStore: ExecutionLogStore;
    analyticsStore: AnalyticsStore;
    sessionId: string;
  }
): Promise<void> {
  await Promise.all([
    oauthStore.deleteConnection(userId),
    sessionStore.deleteSession(sessionId),
    responseStore.deleteByUser(userId),
    executionLogStore.deleteByUser(userId),
    analyticsStore.deleteByUser(userId)
  ]);
}

function corsPreflight(request: Request, frontendAppUrl?: string): Response {
  const originError = requireAllowedOrigin(request, frontendAppUrl);
  if (originError) return originError;

  return withCors(
    new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': requestedCorsHeaders(request) || 'Content-Type, X-Brain-Dump-Admin-Token',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin'
      }
    }),
    request,
    frontendAppUrl
  );
}

function requireAllowedOrigin(request: Request, frontendAppUrl?: string): Response | undefined {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const origin = request.headers.get('Origin');
  if (!origin || !frontendAppUrl) return undefined;

  const allowedOrigin = new URL(frontendAppUrl).origin;
  if (origin === allowedOrigin) return undefined;

  return withCors(json({ error: 'Request origin is not allowed.' }, 403), request, frontendAppUrl);
}

function withCors(response: Response, request: Request, frontendAppUrl?: string): Response {
  const origin = request.headers.get('Origin');
  if (!origin || !frontendAppUrl) return response;

  const allowedOrigin = new URL(frontendAppUrl).origin;
  if (origin !== allowedOrigin) return response;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.append('Vary', 'Origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function requestedCorsHeaders(request: Request): string | undefined {
  return request.headers.get('Access-Control-Request-Headers') ?? undefined;
}

export function buildGoogleAuthorizationUrl(config: GoogleOAuthConfig): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('scope', config.scopes.join(' '));
  return url.toString();
}

async function executeParsedResponse(
  response: BrainDumpResponse,
  workspace: UserWorkspace,
  executor: ActionExecutor,
  request: BrainDumpRequest,
  userId?: string,
  executionLogStore: ExecutionLogStore = createMemoryExecutionLogStore(),
  now: () => Date = () => new Date()
): Promise<BrainDumpResponse> {
  const actions = await Promise.all(
    response.actions.map(async (action): Promise<ParsedAction> => {
      const result = await executor.execute(action, workspace, {
        requestId: request.requestId,
        timezone: request.timezone,
        userId
      });
      await executionLogStore.append({
        requestId: request.requestId,
        userId,
        actionType: action.type,
        title: action.title,
        status: result.status,
        message: result.message,
        providerId: result.providerId,
        createdAt: now().toISOString()
      });
      return {
        ...action,
        status: result.status,
        notes: result.status === 'error' ? result.message : action.notes
      };
    })
  );

  return {
    ...response,
    ok: actions.every((action) => action.status !== 'error'),
    summary: {
      calendar: actions.filter((action) => action.type === 'calendar' && action.status === 'created').length,
      workTasks: actions.filter((action) => action.type === 'work_task' && action.status === 'created').length,
      personalTasks: actions.filter((action) => action.type === 'personal_task' && action.status === 'created').length,
      projects: actions.filter((action) => action.type === 'project' && action.status === 'created').length,
      waiting: actions.filter((action) => action.type === 'waiting' && action.status === 'created').length,
      needsReview: actions.filter((action) => action.status === 'needs_review').length
    },
    actions,
    errors: actions.filter((action) => action.status === 'error').map((action) => action.notes ?? action.title)
  };
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

function disconnectedWorkspace(): UserWorkspace {
  return { status: 'not_connected', destinations: [] };
}

async function readRequestWorkspace(
  request: Request,
  sessionStore: SessionStore,
  oauthStore: OAuthSessionStore
): Promise<{ userId: string; workspace: UserWorkspace } | undefined> {
  const sessionId = readSessionIdFromCookie(request.headers.get('Cookie'));
  if (!sessionId) return undefined;
  const session = await sessionStore.readSession(sessionId);
  if (!session) return undefined;
  const workspace = await oauthStore.readWorkspace(session.userId);
  if (!workspace) return undefined;
  return { userId: session.userId, workspace };
}

async function readRequestSession(request: Request, sessionStore: SessionStore) {
  const sessionId = readSessionIdFromCookie(request.headers.get('Cookie'));
  return sessionId ? sessionStore.readSession(sessionId) : undefined;
}

function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

function csv(value: string, filename: string): Response {
  return new Response(value, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}

function redirect(location: string, headers: Record<string, string> = {}): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      ...headers
    }
  });
}

function callbackReturnUrl(frontendAppUrl: string, params: Record<string, string>): string {
  const url = new URL(frontendAppUrl);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function requireAdmin(request: Request, adminToken: string | undefined, missingMessage: string): Response | undefined {
  if (!adminToken) return json({ error: missingMessage }, 404);
  if (request.headers.get('X-Brain-Dump-Admin-Token') !== adminToken) {
    return json({ error: 'Unauthorized.' }, 401);
  }
  return undefined;
}

function parseAdminLimit(value: string | null): number {
  if (!value) return 20;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) return 20;
  return Math.min(limit, 100);
}

function parseBetaRequestStatusFilter(value: string | null): { ok: true; value?: BetaRequestStatus } | { ok: false; error: string } {
  if (!value) return { ok: true };
  if (value === 'new' || value === 'invited' || value === 'archived') return { ok: true, value };
  return { ok: false, error: 'Invalid beta request status filter.' };
}

function parseFeedbackStatusFilter(value: string | null): { ok: true; value?: FeedbackStatus } | { ok: false; error: string } {
  if (!value) return { ok: true };
  if (value === 'new' || value === 'reviewed' || value === 'archived') return { ok: true, value };
  return { ok: false, error: 'Invalid feedback status filter.' };
}

function parseSupportRequestStatusFilter(value: string | null): { ok: true; value?: SupportRequestStatus } | { ok: false; error: string } {
  if (!value) return { ok: true };
  if (value === 'new' || value === 'in_progress' || value === 'resolved' || value === 'archived') return { ok: true, value };
  return { ok: false, error: 'Invalid support request status filter.' };
}

function betaRequestsCsv(requests: BetaRequestRecord[]): string {
  return recordsToCsv(
    ['createdAt', 'name', 'email', 'tools', 'googleComfort', 'notes', 'status', 'id'],
    requests.map((request) => ({
      createdAt: request.createdAt,
      name: request.name,
      email: request.email,
      tools: request.tools,
      googleComfort: request.googleComfort,
      notes: request.notes ?? '',
      status: request.status,
      id: request.id
    }))
  );
}

function feedbackCsv(feedback: FeedbackRecord[]): string {
  return recordsToCsv(
    ['createdAt', 'email', 'requestId', 'lookedRight', 'confusing', 'expected', 'status', 'id'],
    feedback.map((record) => ({
      createdAt: record.createdAt,
      email: record.email ?? '',
      requestId: record.requestId ?? '',
      lookedRight: record.lookedRight,
      confusing: record.confusing,
      expected: record.expected,
      status: record.status,
      id: record.id
    }))
  );
}

function supportRequestsCsv(requests: SupportRequestRecord[]): string {
  return recordsToCsv(
    ['createdAt', 'email', 'issueType', 'summary', 'details', 'status', 'id'],
    requests.map((request) => ({
      createdAt: request.createdAt,
      email: request.email,
      issueType: request.issueType,
      summary: request.summary,
      details: request.details,
      status: request.status,
      id: request.id
    }))
  );
}

function executionErrorsCsv(errors: ExecutionLogRecord[]): string {
  return recordsToCsv(
    ['createdAt', 'requestId', 'userId', 'actionType', 'title', 'message', 'status'],
    errors.map((error) => ({
      createdAt: error.createdAt,
      requestId: error.requestId,
      userId: error.userId ?? '',
      actionType: error.actionType,
      title: error.title,
      message: error.message ?? '',
      status: error.status
    }))
  );
}

async function buildLaunchSummary({
  generatedAt,
  analyticsStore,
  betaRequestStore,
  feedbackStore,
  supportRequestStore,
  executionLogStore,
  ready
}: {
  generatedAt: string;
  analyticsStore: AnalyticsStore;
  betaRequestStore: BetaRequestStore;
  feedbackStore: FeedbackStore;
  supportRequestStore: SupportRequestStore;
  executionLogStore: ExecutionLogStore;
  ready: boolean;
}): Promise<LaunchSummary> {
  const metrics = summarizeAnalytics(await analyticsStore.readAll());
  const [betaRequests, feedback, supportRequests, recentErrors] = await Promise.all([
    betaRequestStore.readRecent(100),
    feedbackStore.readRecent(100),
    supportRequestStore.readRecent(100),
    executionLogStore.readRecentErrors(100)
  ]);

  return {
    generatedAt,
    ready,
    totalEvents: metrics.totalEvents,
    uniqueUsers: metrics.uniqueUsers,
    totalErrors: metrics.totalErrors,
    latestEventAt: metrics.latestEventAt,
    queueCounts: {
      beta: countByStatus(betaRequests, ['new', 'invited', 'archived']),
      feedback: countByStatus(feedback, ['new', 'reviewed', 'archived']),
      support: countByStatus(supportRequests, ['new', 'in_progress', 'resolved', 'archived']),
      recentExecutionErrors: recentErrors.length
    }
  };
}

function countByStatus<T extends string>(records: Array<{ status: T }>, statuses: T[]): Record<T, number> {
  const counts = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<T, number>;
  for (const record of records) counts[record.status] = (counts[record.status] ?? 0) + 1;
  return counts;
}

function recordsToCsv(headers: string[], rows: Array<Record<string, string>>): string {
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}

function csvCell(value: string): string {
  const normalized = neutralizeSpreadsheetFormula(value.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
  if (!/[",\n]/.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '""')}"`;
}

function neutralizeSpreadsheetFormula(value: string): string {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}
