import { parseBrainDump } from '../lib/parser';
import type { BrainDumpRequest, BrainDumpResponse, ParsedAction, UserWorkspace } from '../lib/types';
import { publicBackendRoutes } from '../api/publicContract';
import { createDemoActionExecutor, type ActionExecutor } from './actionExecutor';
import {
  completeOAuthSession,
  createMemoryOAuthStore,
  startOAuthSession,
  type OAuthSessionStore,
  type TokenExchangeClient
} from './oauthSession';
import {
  clearSessionCookie,
  createMemorySessionStore,
  readSessionIdFromCookie,
  sessionCookie,
  type SessionStore
} from './sessionStore';

export type GoogleOAuthConfig = {
  clientId: string;
  redirectUri: string;
  scopes: string[];
};

export type PublicBackendOptions = {
  googleOAuth: GoogleOAuthConfig;
  workspace?: UserWorkspace;
  executor?: ActionExecutor;
  oauthStore?: OAuthSessionStore;
  tokenClient?: TokenExchangeClient;
  sessionStore?: SessionStore;
};

export function createPublicBackend(options: PublicBackendOptions) {
  const responsesByRequestId = new Map<string, BrainDumpResponse>();
  let fallbackWorkspace = options.workspace;
  const executor = options.executor ?? createDemoActionExecutor();
  const oauthStore = options.oauthStore ?? createMemoryOAuthStore();
  const sessionStore = options.sessionStore ?? createMemorySessionStore();

  return {
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);

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
            tokenClient: options.tokenClient
          });
          const session = await sessionStore.createSession(workspace.email?.toLowerCase() ?? '');
          responsesByRequestId.clear();
          return json(workspace, 200, { 'Set-Cookie': sessionCookie(session.id) });
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : 'OAuth callback failed.' }, 400);
        }
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.googleDisconnect) {
        const sessionId = readSessionIdFromCookie(request.headers.get('Cookie'));
        if (sessionId) await sessionStore.deleteSession(sessionId);
        fallbackWorkspace = undefined;
        responsesByRequestId.clear();
        return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.brainDump) {
        const requestWorkspace = await readRequestWorkspace(request, sessionStore, oauthStore);
        const workspace = requestWorkspace?.workspace ?? fallbackWorkspace ?? disconnectedWorkspace();
        if (workspace.status !== 'connected') {
          return json({ error: 'Google workspace is not connected.' }, 409);
        }

        const body = (await request.json()) as BrainDumpRequest;
        if (responsesByRequestId.has(body.requestId)) {
          return json(responsesByRequestId.get(body.requestId));
        }

        const response = await executeParsedResponse(
          parseBrainDump(body.text, body.requestId),
          workspace,
          executor,
          body,
          requestWorkspace?.userId
        );
        responsesByRequestId.set(body.requestId, response);
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
  userId?: string
): Promise<BrainDumpResponse> {
  const actions = await Promise.all(
    response.actions.map(async (action): Promise<ParsedAction> => {
      const result = await executor.execute(action, workspace, {
        requestId: request.requestId,
        timezone: request.timezone,
        userId
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

function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}
