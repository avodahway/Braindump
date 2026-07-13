import { describe, expect, it } from 'vitest';
import type { ParsedAction } from '../lib/types';
import { createMemoryOAuthStore, type TokenExchangeClient } from './oauthSession';
import { buildGoogleAuthorizationUrl, createPublicBackend } from './publicBackend';
import { createMemorySessionStore, sessionCookieName } from './sessionStore';
import { createMemoryResponseStore } from './idempotencyStore';
import { createMemoryExecutionLogStore } from './executionLogStore';
import { createMemoryAnalyticsStore } from './analyticsStore';

const googleOAuth = {
  clientId: 'client-id',
  redirectUri: 'https://api.example.com/api/auth/google/callback',
  scopes: ['openid', 'email', 'https://www.googleapis.com/auth/tasks']
};

describe('public backend scaffold', () => {
  it('returns anonymous health status', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      now: () => new Date('2026-07-12T12:00:00.000Z')
    });

    const response = await backend.handle(new Request('https://api.example.com/api/health'));

    expect(await response.json()).toEqual({
      ok: true,
      service: 'brain-dump-public-backend',
      time: '2026-07-12T12:00:00.000Z'
    });
  });

  it('builds a Google OAuth authorization URL', () => {
    const url = new URL(buildGoogleAuthorizationUrl(googleOAuth));

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/tasks');
  });

  it('returns workspace and processes brain dumps through the public route', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace()
    });

    const workspaceResponse = await backend.handle(new Request('https://api.example.com/api/workspace'));
    const workspace = await workspaceResponse.json();
    expect(workspace.status).toBe('connected');

    const processResponse = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-1',
          text: 'Pay employees tomorrow. Lunch with Jack Thursday at noon; put on calendar.',
          timezone: 'America/Chicago'
        })
      })
    );
    const result = await processResponse.json();
    expect(result.summary.workTasks).toBe(1);
    expect(result.summary.calendar).toBe(1);
    expect(result.actions.every((action: { status: string }) => action.status === 'created')).toBe(true);
  });

  it('returns the same response for duplicate request ids', async () => {
    const backend = createPublicBackend({ googleOAuth, workspace: connectedWorkspace() });
    const request = {
      requestId: 'req-duplicate',
      text: 'Buy coffee',
      timezone: 'America/Chicago'
    };

    const first = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify(request)
      })
    );
    const second = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({ ...request, text: 'Different text' })
      })
    );

    expect(await first.json()).toEqual(await second.json());
  });

  it('uses an injected response store for duplicate request ids', async () => {
    const responseStore = createMemoryResponseStore();
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace(),
      responseStore,
      executor: {
        async execute(action) {
          return { status: 'created', message: `Created ${action.title}` };
        }
      }
    });

    await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-store',
          text: 'Buy coffee',
          timezone: 'America/Chicago'
        })
      })
    );

    expect(await responseStore.readResponse('req-store')).toMatchObject({ requestId: 'req-store' });
  });

  it('executes approved actions instead of reparsing the original text', async () => {
    const createdTitles: string[] = [];
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace(),
      executor: {
        async execute(action) {
          createdTitles.push(action.title);
          return { status: 'created', message: `Created ${action.title}` };
        }
      }
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-approved',
          text: 'Pay employees tomorrow. Lunch with Jack Thursday at noon; put on calendar.',
          timezone: 'America/Chicago',
          approvedActions: [
            {
              type: 'work_task',
              title: 'Pay employees tomorrow',
              status: 'planned',
              dueDate: 'tomorrow',
              notes: 'Pay employees tomorrow.',
              sourceText: 'Pay employees tomorrow.'
            }
          ]
        })
      })
    );
    const result = await response.json();

    expect(createdTitles).toEqual(['Pay employees tomorrow']);
    expect(result.summary.workTasks).toBe(1);
    expect(result.summary.calendar).toBe(0);
  });

  it('blocks processing after disconnect', async () => {
    const backend = createPublicBackend({ googleOAuth, workspace: connectedWorkspace() });

    await backend.handle(new Request('https://api.example.com/api/auth/google/disconnect', { method: 'POST' }));
    const response = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({ requestId: 'req-2', text: 'Buy coffee', timezone: 'America/Chicago' })
      })
    );

    expect(response.status).toBe(409);
  });

  it('uses the injected executor and returns execution failures', async () => {
    const executionLogStore = createMemoryExecutionLogStore();
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace(),
      executionLogStore,
      now: () => new Date('2026-07-12T12:00:00.000Z'),
      executor: {
        async execute(action: ParsedAction) {
          return action.type === 'calendar'
            ? { status: 'error', message: 'Calendar write failed' }
            : { status: 'created', message: 'Created' };
        }
      }
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-executor',
          text: 'Lunch with Jack Thursday at noon; put on calendar.',
          timezone: 'America/Chicago'
        })
      })
    );
    const result = await response.json();

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['Calendar write failed']);
    expect(await executionLogStore.readByRequest('req-executor')).toEqual([
      {
        requestId: 'req-executor',
        userId: undefined,
        actionType: 'calendar',
        title: 'Lunch with Jack',
        status: 'error',
        message: 'Calendar write failed',
        providerId: undefined,
        createdAt: '2026-07-12T12:00:00.000Z'
      }
    ]);
  });

  it('passes request timezone into the executor context', async () => {
    let timezone = '';
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace(),
      executor: {
        async execute(_action, _workspace, context) {
          timezone = context?.timezone ?? '';
          return { status: 'created', message: 'Created' };
        }
      }
    });

    await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-timezone',
          text: 'Buy coffee',
          timezone: 'America/Chicago'
        })
      })
    );

    expect(timezone).toBe('America/Chicago');
  });

  it('starts and completes OAuth through backend routes', async () => {
    const store = createMemoryOAuthStore();
    const sessionStore = createMemorySessionStore(() => 1234);
    const backend = createPublicBackend({
      googleOAuth,
      oauthStore: store,
      sessionStore,
      tokenClient: fakeTokenClient()
    });

    const startResponse = await backend.handle(
      new Request('https://api.example.com/api/auth/google/start', { method: 'POST' })
    );
    const start = await startResponse.json();
    const authorization = new URL(start.authorizationUrl);

    expect(authorization.searchParams.get('state')).toBe(start.state);
    expect(store.states.has(start.state)).toBe(true);

    const callbackResponse = await backend.handle(
      new Request(`https://api.example.com/api/auth/google/callback?code=auth-code&state=${start.state}`)
    );
    const workspace = await callbackResponse.json();

    expect(workspace.status).toBe('connected');
    expect(workspace.email).toBe('user@example.com');
    expect(store.tokens.has('user@example.com')).toBe(true);
    expect(callbackResponse.headers.get('Set-Cookie')).toContain(`${sessionCookieName}=`);
    expect(sessionStore.sessions.size).toBe(1);
  });

  it('redirects OAuth callbacks back to the app when a frontend URL is configured', async () => {
    const store = createMemoryOAuthStore();
    const backend = createPublicBackend({
      googleOAuth,
      frontendAppUrl: 'https://app.example.com/app',
      oauthStore: store,
      tokenClient: fakeTokenClient()
    });

    const startResponse = await backend.handle(
      new Request('https://api.example.com/api/auth/google/start', { method: 'POST' })
    );
    const start = await startResponse.json();
    const callbackResponse = await backend.handle(
      new Request(`https://api.example.com/api/auth/google/callback?code=auth-code&state=${start.state}`)
    );

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.get('Location')).toBe('https://app.example.com/app?connected=google');
    expect(callbackResponse.headers.get('Set-Cookie')).toContain(`${sessionCookieName}=`);
  });

  it('rejects callback requests with invalid state', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      oauthStore: createMemoryOAuthStore(),
      tokenClient: fakeTokenClient()
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/auth/google/callback?code=auth-code&state=bad')
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid OAuth state.' });
  });

  it('redirects OAuth callback errors back to the app when configured', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      frontendAppUrl: 'https://app.example.com/app',
      oauthStore: createMemoryOAuthStore(),
      tokenClient: fakeTokenClient()
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/auth/google/callback?code=auth-code&state=bad')
    );
    const location = new URL(response.headers.get('Location') ?? '');

    expect(response.status).toBe(302);
    expect(location.origin + location.pathname).toBe('https://app.example.com/app');
    expect(location.searchParams.get('connection')).toBe('error');
    expect(location.searchParams.get('reason')).toBe('Invalid OAuth state.');
  });

  it('uses session cookies to read workspace and process requests', async () => {
    const oauthStore = createMemoryOAuthStore();
    const sessionStore = createMemorySessionStore(() => 1234);
    const executionLogStore = createMemoryExecutionLogStore();
    await oauthStore.saveWorkspace('user@example.com', connectedWorkspace());
    const session = await sessionStore.createSession('user@example.com');
    const backend = createPublicBackend({
      googleOAuth,
      oauthStore,
      sessionStore,
      executionLogStore,
      now: () => new Date('2026-07-12T12:00:00.000Z')
    });

    const workspaceResponse = await backend.handle(
      new Request('https://api.example.com/api/workspace', {
        headers: { Cookie: `${sessionCookieName}=${session.id}` }
      })
    );
    const workspace = await workspaceResponse.json();
    expect(workspace.status).toBe('connected');

    const processResponse = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        headers: { Cookie: `${sessionCookieName}=${session.id}` },
        body: JSON.stringify({
          requestId: 'req-session',
          text: 'Buy coffee',
          timezone: 'America/Chicago'
        })
      })
    );
    const result = await processResponse.json();
    expect(result.summary.personalTasks).toBe(1);
    expect(await executionLogStore.readByRequest('req-session')).toMatchObject([
      {
        requestId: 'req-session',
        userId: 'user@example.com',
        actionType: 'personal_task',
        title: 'Buy coffee',
        status: 'created',
        createdAt: '2026-07-12T12:00:00.000Z'
      }
    ]);
  });

  it('clears the session on disconnect', async () => {
    const sessionStore = createMemorySessionStore(() => 1234);
    const oauthStore = createMemoryOAuthStore();
    await oauthStore.saveTokens('user@example.com', {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 2000,
      scope: googleOAuth.scopes.join(' ')
    });
    await oauthStore.saveWorkspace('user@example.com', connectedWorkspace());
    const session = await sessionStore.createSession('user@example.com');
    const backend = createPublicBackend({ googleOAuth, oauthStore, sessionStore });

    const response = await backend.handle(
      new Request('https://api.example.com/api/auth/google/disconnect', {
        method: 'POST',
        headers: { Cookie: `${sessionCookieName}=${session.id}` }
      })
    );

    expect(await sessionStore.readSession(session.id)).toBeUndefined();
    expect(await oauthStore.readTokens('user@example.com')).toBeUndefined();
    expect(await oauthStore.readWorkspace('user@example.com')).toBeUndefined();
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('stores privacy-safe analytics events without brain dump text', async () => {
    const analyticsStore = createMemoryAnalyticsStore();
    const sessionStore = createMemorySessionStore(() => 1234);
    const session = await sessionStore.createSession('user@example.com');
    const backend = createPublicBackend({
      googleOAuth,
      sessionStore,
      analyticsStore,
      now: () => new Date('2026-07-12T12:00:00.000Z')
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/events', {
        method: 'POST',
        headers: { Cookie: `${sessionCookieName}=${session.id}` },
        body: JSON.stringify({
          name: 'review_created',
          requestId: 'req-analytics',
          text: 'Pay employees tomorrow',
          actionCount: 1
        })
      })
    );

    expect(response.status).toBe(200);
    expect(analyticsStore.records).toEqual([
      {
        name: 'review_created',
        requestId: 'req-analytics',
        actionCount: 1,
        userId: 'user@example.com',
        createdAt: '2026-07-12T12:00:00.000Z'
      }
    ]);
  });

  it('protects beta analytics metrics with an admin token', async () => {
    const analyticsStore = createMemoryAnalyticsStore();
    await analyticsStore.append({
      name: 'review_created',
      requestId: 'req-1',
      userId: 'user@example.com',
      actionCount: 2,
      createdAt: '2026-07-12T12:00:00.000Z'
    });
    const backend = createPublicBackend({
      googleOAuth,
      analyticsStore,
      adminToken: 'admin-secret'
    });

    const unauthorized = await backend.handle(new Request('https://api.example.com/api/admin/metrics'));
    const authorized = await backend.handle(
      new Request('https://api.example.com/api/admin/metrics', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-secret' }
      })
    );

    expect(unauthorized.status).toBe(401);
    expect(await authorized.json()).toEqual({
      totalEvents: 1,
      uniqueUsers: 1,
      uniqueRequests: 1,
      totalActions: 2,
      totalErrors: 0,
      byName: {
        review_created: 1
      },
      latestEventAt: '2026-07-12T12:00:00.000Z'
    });
  });

  it('does not expose beta analytics metrics until configured', async () => {
    const backend = createPublicBackend({ googleOAuth });

    const response = await backend.handle(new Request('https://api.example.com/api/admin/metrics'));

    expect(response.status).toBe(404);
  });

  it('protects the beta backup plan with an admin token', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      adminToken: 'admin-secret',
      storageKeyPrefix: 'prod',
      now: () => new Date('2026-07-12T12:00:00.000Z')
    });

    const unauthorized = await backend.handle(new Request('https://api.example.com/api/admin/backup-plan'));
    const authorized = await backend.handle(
      new Request('https://api.example.com/api/admin/backup-plan', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-secret' }
      })
    );
    const plan = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(plan).toMatchObject({
      generatedAt: '2026-07-12T12:00:00.000Z',
      storagePrefix: 'prod'
    });
    expect(JSON.stringify(plan)).toContain('Do not export tokens');
  });
});

function connectedWorkspace() {
  return {
    status: 'connected' as const,
    email: 'demo@braindump.local',
    destinations: [
      { id: 'tasks-work', name: 'Brain Dump Work', provider: 'google_tasks' as const, kind: 'work_tasks' as const, isDefault: true },
      { id: 'tasks-personal', name: 'Brain Dump Personal', provider: 'google_tasks' as const, kind: 'personal_tasks' as const, isDefault: true },
      { id: 'calendar', name: 'Brain Dump Calendar', provider: 'google_calendar' as const, kind: 'calendar' as const, isDefault: true },
      { id: 'projects', name: 'Brain Dump Projects', provider: 'brain_dump_workspace' as const, kind: 'projects' as const, isDefault: true },
      { id: 'waiting', name: 'Brain Dump Waiting On', provider: 'brain_dump_workspace' as const, kind: 'waiting' as const, isDefault: true }
    ]
  };
}

function fakeTokenClient(): TokenExchangeClient {
  return {
    async exchangeCode() {
      return {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600,
        scope: googleOAuth.scopes.join(' ')
      };
    },
    async refreshTokens() {
      return {
        accessToken: 'new-access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600,
        scope: googleOAuth.scopes.join(' ')
      };
    },
    async readProfile() {
      return { email: 'user@example.com' };
    }
  };
}
