import { parseBrainDump } from '../lib/parser';
import type { BrainDumpRequest, BrainDumpResponse, ParsedAction, UserWorkspace } from '../lib/types';
import { publicBackendRoutes } from '../api/publicContract';
import { createDemoActionExecutor, type ActionExecutor } from './actionExecutor';

export type GoogleOAuthConfig = {
  clientId: string;
  redirectUri: string;
  scopes: string[];
};

export type PublicBackendOptions = {
  googleOAuth: GoogleOAuthConfig;
  workspace?: UserWorkspace;
  executor?: ActionExecutor;
};

export function createPublicBackend(options: PublicBackendOptions) {
  const responsesByRequestId = new Map<string, BrainDumpResponse>();
  let workspace = options.workspace ?? demoWorkspace();
  const executor = options.executor ?? createDemoActionExecutor();

  return {
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);

      if (request.method === 'GET' && url.pathname === publicBackendRoutes.workspace) {
        return json(workspace);
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.googleConnect) {
        workspace = demoWorkspace();
        return json({ authorizationUrl: buildGoogleAuthorizationUrl(options.googleOAuth) });
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.googleDisconnect) {
        workspace = { status: 'not_connected', destinations: [] };
        responsesByRequestId.clear();
        return json({ ok: true });
      }

      if (request.method === 'POST' && url.pathname === publicBackendRoutes.brainDump) {
        if (workspace.status !== 'connected') {
          return json({ error: 'Google workspace is not connected.' }, 409);
        }

        const body = (await request.json()) as BrainDumpRequest;
        if (responsesByRequestId.has(body.requestId)) {
          return json(responsesByRequestId.get(body.requestId));
        }

        const response = await executeParsedResponse(parseBrainDump(body.text, body.requestId), workspace, executor);
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
  executor: ActionExecutor
): Promise<BrainDumpResponse> {
  const actions = await Promise.all(
    response.actions.map(async (action): Promise<ParsedAction> => {
      const result = await executor.execute(action, workspace);
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

function demoWorkspace(): UserWorkspace {
  return {
    status: 'connected',
    email: 'demo@braindump.local',
    destinations: [
      {
        id: 'tasks-work',
        name: 'Brain Dump Work',
        provider: 'google_tasks',
        kind: 'work_tasks',
        isDefault: true
      },
      {
        id: 'tasks-personal',
        name: 'Brain Dump Personal',
        provider: 'google_tasks',
        kind: 'personal_tasks',
        isDefault: true
      },
      {
        id: 'calendar',
        name: 'Brain Dump Calendar',
        provider: 'google_calendar',
        kind: 'calendar',
        isDefault: true
      },
      {
        id: 'projects',
        name: 'Brain Dump Projects',
        provider: 'brain_dump_workspace',
        kind: 'projects',
        isDefault: true
      },
      {
        id: 'waiting',
        name: 'Brain Dump Waiting On',
        provider: 'brain_dump_workspace',
        kind: 'waiting',
        isDefault: true
      }
    ]
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
