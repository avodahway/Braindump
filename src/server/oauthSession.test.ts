import { describe, expect, it, vi } from 'vitest';
import {
  completeOAuthSession,
  createMemoryOAuthStore,
  defaultWorkspace,
  startOAuthSession,
  type TokenExchangeClient
} from './oauthSession';

const googleOAuth = {
  clientId: 'client-id',
  redirectUri: 'https://api.example.com/api/auth/google/callback',
  scopes: ['openid', 'email', 'https://www.googleapis.com/auth/tasks']
};

describe('OAuth session helpers', () => {
  it('starts an OAuth session with a stored state', async () => {
    const store = createMemoryOAuthStore();
    const result = await startOAuthSession(googleOAuth, store, 1000);
    const url = new URL(result.authorizationUrl);

    expect(result.state).toHaveLength(48);
    expect(url.searchParams.get('state')).toBe(result.state);
    expect(store.states.get(result.state)?.createdAt).toBe(1000);
  });

  it('completes OAuth, stores tokens, and creates a default workspace', async () => {
    const store = createMemoryOAuthStore();
    await store.saveState({ state: 'state-1', createdAt: 1000 });
    const tokenClient = fakeTokenClient();

    const workspace = await completeOAuthSession({
      code: 'auth-code',
      state: 'state-1',
      store,
      tokenClient,
      now: 2000
    });

    expect(workspace.email).toBe('User@Example.com');
    expect(store.tokens.has('user@example.com')).toBe(true);
    expect(store.workspaces.get('user@example.com')?.destinations).toHaveLength(5);
    expect(tokenClient.exchangeCode).toHaveBeenCalledWith('auth-code');
  });

  it('uses an injected workspace provisioner during OAuth completion', async () => {
    const store = createMemoryOAuthStore();
    await store.saveState({ state: 'state-1', createdAt: 1000 });

    const workspace = await completeOAuthSession({
      code: 'auth-code',
      state: 'state-1',
      store,
      tokenClient: fakeTokenClient(),
      workspaceProvisioner: {
        async provision(profile) {
          return {
            ...defaultWorkspace(profile.email),
            destinations: [
              {
                id: 'real-work-list-id',
                name: 'Brain Dump Work',
                provider: 'google_tasks',
                kind: 'work_tasks',
                isDefault: true
              }
            ]
          };
        }
      },
      now: 2000
    });

    expect(workspace.destinations[0].id).toBe('real-work-list-id');
    expect(store.workspaces.get('user@example.com')?.destinations[0].id).toBe('real-work-list-id');
  });

  it('rejects invalid and expired state', async () => {
    const store = createMemoryOAuthStore();
    await expect(
      completeOAuthSession({
        code: 'auth-code',
        state: 'missing',
        store,
        tokenClient: fakeTokenClient()
      })
    ).rejects.toThrow('Invalid OAuth state.');

    await store.saveState({ state: 'expired', createdAt: 0 });
    await expect(
      completeOAuthSession({
        code: 'auth-code',
        state: 'expired',
        store,
        tokenClient: fakeTokenClient(),
        now: 11 * 60 * 1000
      })
    ).rejects.toThrow('OAuth state expired.');
  });

  it('creates default destinations for a connected user', () => {
    expect(defaultWorkspace('person@example.com').destinations.map((destination) => destination.kind)).toEqual([
      'work_tasks',
      'personal_tasks',
      'calendar',
      'projects',
      'waiting'
    ]);
  });

  it('deletes stored connection data', async () => {
    const store = createMemoryOAuthStore();
    await store.saveTokens('user@example.com', {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 2000,
      scope: googleOAuth.scopes.join(' ')
    });
    await store.saveWorkspace('user@example.com', defaultWorkspace('user@example.com'));

    await store.deleteConnection('user@example.com');

    expect(await store.readTokens('user@example.com')).toBeUndefined();
    expect(await store.readWorkspace('user@example.com')).toBeUndefined();
  });
});

function fakeTokenClient(): TokenExchangeClient {
  return {
    exchangeCode: vi.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 2000,
      scope: 'openid email https://www.googleapis.com/auth/tasks'
    }),
    refreshTokens: vi.fn().mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'refresh-token',
      expiresAt: 3000,
      scope: 'openid email https://www.googleapis.com/auth/tasks'
    }),
    readProfile: vi.fn().mockResolvedValue({
      email: 'User@Example.com'
    })
  };
}
