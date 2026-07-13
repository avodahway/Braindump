import { parseBrainDump } from '../lib/parser';
import type { BrainDumpRequest, BrainDumpResponse, ParsedAction, UserWorkspace } from '../lib/types';
import { publicBackendRoutes } from '../api/publicContract';
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
import { createMemoryExecutionLogStore, type ExecutionLogStore } from './executionLogStore';
import { createMemoryAnalyticsStore, sanitizeAnalyticsEvent, summarizeAnalytics, type AnalyticsStore } from './analyticsStore';
import { buildBackupPlan } from './backupPlan';

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
  adminToken?: string;
  storageKeyPrefix?: string;
  now?: () => Date;
};

export function createPublicBackend(options: PublicBackendOptions) {
  let fallbackWorkspace = options.workspace;
  const executor = options.executor ?? createDemoActionExecutor();
  const oauthStore = options.oauthStore ?? createMemoryOAuthStore();
  const sessionStore = options.sessionStore ?? createMemorySessionStore();
  const responseStore = options.responseStore ?? createMemoryResponseStore();
  const executionLogStore = options.executionLogStore ?? createMemoryExecutionLogStore();
  const analyticsStore = options.analyticsStore ?? createMemoryAnalyticsStore();
  const now = options.now ?? (() => new Date());

  return {
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.health) {
        return json({
          ok: true,
          service: 'brain-dump-public-backend',
          time: now().toISOString()
        });
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.workspace) {
        return json((await readRequestWorkspace(request, sessionStore, oauthStore))?.workspace ?? fallbackWorkspace ?? disconnectedWorkspace());
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.googleConnect) {
        return json(await startOAuthSession(options.googleOAuth, oauthStore));
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.googleCallback) {
        if (!options.tokenClient) {
          return json({ error: 'OAuth token client is not configured.' }, 501);
        }

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code || !state) {
          return json({ error: 'Missing OAuth code or state.' }, 400);
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
          await responseStore.clear();
          await executionLogStore.clear();
          if (options.frontendAppUrl) {
            return redirect(callbackReturnUrl(options.frontendAppUrl, { connected: 'google' }), {
              'Set-Cookie': sessionCookie(session.id)
            });
          }
          return json(workspace, 200, { 'Set-Cookie': sessionCookie(session.id) });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'OAuth callback failed.';
          if (options.frontendAppUrl) {
            return redirect(callbackReturnUrl(options.frontendAppUrl, { connection: 'error', reason: message }));
          }
          return json({ error: message }, 400);
        }
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.googleDisconnect) {
        const sessionId = readSessionIdFromCookie(request.headers.get('Cookie'));
        if (sessionId) {
          const session = await sessionStore.readSession(sessionId);
          if (session) await oauthStore.deleteConnection(session.userId);
          await sessionStore.deleteSession(sessionId);
        }
        fallbackWorkspace = undefined;
        await responseStore.clear();
        await executionLogStore.clear();
        return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.events) {
        const event = sanitizeAnalyticsEvent(await request.json());
        if (!event) return json({ error: 'Invalid analytics event.' }, 400);
        const session = await readRequestSession(request, sessionStore);
        await analyticsStore.append({
          ...event,
          userId: session?.userId,
          createdAt: now().toISOString()
        });
        return json({ ok: true });
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.adminMetrics) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin metrics are not configured.');
        if (adminError) return adminError;
        return json(summarizeAnalytics(await analyticsStore.readAll()));
      }

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.adminBackupPlan) {
        const adminError = requireAdmin(request, options.adminToken, 'Admin backup plan is not configured.');
        if (adminError) return adminError;
        return json(
          buildBackupPlan({
            storagePrefix: options.storageKeyPrefix,
            generatedAt: now().toISOString()
          })
        );
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.brainDump) {
        const requestWorkspace = await readRequestWorkspace(request, sessionStore, oauthStore);
        const workspace = requestWorkspace?.workspace ?? fallbackWorkspace ?? disconnectedWorkspace();
        if (workspace.status !== 'connected') {
          return json({ error: 'Google workspace is not connected.' }, 409);
        }

        const body = (await request.json()) as BrainDumpRequest;
        const savedResponse = await responseStore.readResponse(body.requestId);
        if (savedResponse) {
          return json(savedResponse);
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
        await responseStore.saveResponse(body.requestId, response);
        return json(response);
      }

      return json({ error: 'Not found' }, 404);
    }
  };
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
