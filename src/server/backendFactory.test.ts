import { describe, expect, it } from 'vitest';
import { sessionCookieName, createMemorySessionStore } from './sessionStore';
import { createBrainDumpBackend, createGoogleBackedExecutor } from './backendFactory';
import { createMemoryOAuthStore, defaultWorkspace, type TokenExchangeClient } from './oauthSession';
import { createMemoryKeyValueStore } from './durableStore';
import type { ParsedAction } from '../lib/types';

const googleOAuth = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://api.example.com/api/auth/google/callback',
  scopes: ['openid', 'email', 'https://www.googleapis.com/auth/tasks', 'https://www.googleapis.com/auth/calendar.events']
};

describe('backend factory', () => {
  it('executes signed-in requests with the session user tokens', async () => {
    const calls: Array<{ url: string; authorization?: string; body?: unknown }> = [];
    const oauthStore = createMemoryOAuthStore();
    const sessionStore = createMemorySessionStore(() => 1000);
    const workspace = defaultWorkspace('User@Example.com');
    await oauthStore.saveWorkspace('user@example.com', workspace);
    await oauthStore.saveTokens('user@example.com', {
      accessToken: 'old-token',
      refreshToken: 'refresh-token',
      expiresAt: 1000,
      scope: googleOAuth.scopes.join(' ')
    });
    const session = await sessionStore.createSession('user@example.com');

    const backend = createBrainDumpBackend({
      googleOAuth,
      oauthStore,
      sessionStore,
      nowMs: () => 2_000,
      nowDate: () => new Date('2026-07-12T12:00:00.000Z'),
      fetcher: async (input, init) => {
        const url = String(input);
        if (url === 'https://oauth2.googleapis.com/token') {
          return jsonResponse({ access_token: 'fresh-token', expires_in: 3600, scope: googleOAuth.scopes.join(' ') });
        }

        calls.push({
          url,
          authorization: headerValue(init?.headers, 'Authorization'),
          body: init?.body ? JSON.parse(String(init.body)) : undefined
        });
        return jsonResponse({ id: 'google-task-id' });
      }
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        headers: { Cookie: `${sessionCookieName}=${session.id}` },
        body: JSON.stringify({
          requestId: 'req-runtime',
          text: 'Pay employees tomorrow',
          timezone: 'America/Chicago'
        })
      })
    );
    const result = await response.json();

    expect(result.ok).toBe(true);
    expect(result.summary.workTasks).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/lists/brain-dump-work/tasks');
    expect(calls[0].authorization).toBe('Bearer fresh-token');
    expect(calls[0].body).toMatchObject({
      title: 'Pay employees tomorrow',
      due: '2026-07-13T00:00:00.000Z'
    });
  });

  it('returns an execution error when no signed-in user can be resolved', async () => {
    const executor = createGoogleBackedExecutor({
      oauthStore: createMemoryOAuthStore(),
      tokenClient: fakeTokenClient()
    });
    const action: ParsedAction = {
      type: 'work_task',
      title: 'Pay vendor',
      sourceText: 'Pay vendor',
      status: 'planned'
    };

    const result = await executor.execute(action, { status: 'connected', destinations: [] }, {
      requestId: 'req-1',
      timezone: 'America/Chicago'
    });

    expect(result).toEqual({
      status: 'error',
      message: 'No signed-in Google user is available for this request.'
    });
  });

  it('can compose OAuth and session storage from a shared durable store', async () => {
    const storage = createMemoryKeyValueStore();
    const backend = createBrainDumpBackend({
      googleOAuth,
      storage,
      storageKeyPrefix: 'test',
      tokenClient: callbackTokenClient(),
      workspaceProvisioner: {
        async provision(profile) {
          return defaultWorkspace(profile.email);
        }
      }
    });

    const startResponse = await backend.handle(
      new Request('https://api.example.com/api/auth/google/start', { method: 'POST' })
    );
    const start = await startResponse.json();
    const callbackResponse = await backend.handle(
      new Request(`https://api.example.com/api/auth/google/callback?code=auth-code&state=${start.state}`)
    );
    const cookie = callbackResponse.headers.get('Set-Cookie') ?? '';

    const workspaceResponse = await backend.handle(
      new Request('https://api.example.com/api/workspace', { headers: { Cookie: cookie.split(';')[0] } })
    );
    const workspace = await workspaceResponse.json();

    expect(workspace.status).toBe('connected');
    expect(workspace.email).toBe('user@example.com');
    expect([...storage.values.keys()].some((key) => key.includes(':google-tokens:user@example.com'))).toBe(true);
    expect([...storage.values.keys()].some((key) => key.includes(':session:'))).toBe(true);
  });
});

function fakeTokenClient(): TokenExchangeClient {
  return {
    async exchangeCode() {
      throw new Error('not used');
    },
    async refreshTokens(refreshToken) {
      return {
        accessToken: 'fresh-token',
        refreshToken,
        expiresAt: Date.now() + 3600_000,
        scope: googleOAuth.scopes.join(' ')
      };
    },
    async readProfile() {
      throw new Error('not used');
    }
  };
}

function callbackTokenClient(): TokenExchangeClient {
  return {
    async exchangeCode() {
      return {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600_000,
        scope: googleOAuth.scopes.join(' ')
      };
    },
    async refreshTokens(refreshToken) {
      return {
        accessToken: 'fresh-token',
        refreshToken,
        expiresAt: Date.now() + 3600_000,
        scope: googleOAuth.scopes.join(' ')
      };
    },
    async readProfile() {
      return { email: 'user@example.com' };
    }
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function headerValue(headers: HeadersInit | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  if (Array.isArray(headers)) {
    return headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  }
  return headers[name] ?? headers[name.toLowerCase()];
}
