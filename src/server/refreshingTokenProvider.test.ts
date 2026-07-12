import { describe, expect, it, vi } from 'vitest';
import { createMemoryOAuthStore, type TokenExchangeClient } from './oauthSession';
import { createRefreshingTokenProvider } from './refreshingTokenProvider';

describe('refreshing token provider', () => {
  it('returns stored access token when it is still fresh', async () => {
    const store = createMemoryOAuthStore();
    await store.saveTokens('user@example.com', {
      accessToken: 'fresh-access',
      refreshToken: 'refresh',
      expiresAt: 120_000,
      scope: 'scope'
    });
    const tokenClient = fakeTokenClient();

    await expect(
      createRefreshingTokenProvider({ userId: 'user@example.com', store, tokenClient, now: () => 1000 }).getAccessToken()
    ).resolves.toBe('fresh-access');
    expect(tokenClient.refreshTokens).not.toHaveBeenCalled();
  });

  it('refreshes and stores tokens when access token is near expiration', async () => {
    const store = createMemoryOAuthStore();
    await store.saveTokens('user@example.com', {
      accessToken: 'old-access',
      refreshToken: 'refresh',
      expiresAt: 1500,
      scope: 'scope'
    });
    const tokenClient = fakeTokenClient();

    await expect(
      createRefreshingTokenProvider({ userId: 'user@example.com', store, tokenClient, now: () => 1000 }).getAccessToken()
    ).resolves.toBe('new-access');

    expect(tokenClient.refreshTokens).toHaveBeenCalledWith('refresh');
    expect((await store.readTokens('user@example.com'))?.accessToken).toBe('new-access');
  });

  it('fails when no tokens exist for the user', async () => {
    await expect(
      createRefreshingTokenProvider({
        userId: 'missing@example.com',
        store: createMemoryOAuthStore(),
        tokenClient: fakeTokenClient()
      }).getAccessToken()
    ).rejects.toThrow('No Google tokens stored for user.');
  });
});

function fakeTokenClient(): TokenExchangeClient {
  return {
    exchangeCode: vi.fn(),
    refreshTokens: vi.fn().mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'refresh',
      expiresAt: 20_000,
      scope: 'scope'
    }),
    readProfile: vi.fn()
  };
}
