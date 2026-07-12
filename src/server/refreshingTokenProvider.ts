import type { GoogleTokenSet, OAuthSessionStore, TokenExchangeClient } from './oauthSession';
import type { TokenProvider } from './googleProviderClients';

export type RefreshingTokenProviderOptions = {
  userId: string;
  store: OAuthSessionStore;
  tokenClient: TokenExchangeClient;
  now?: () => number;
  refreshSkewMs?: number;
};

export function createRefreshingTokenProvider(options: RefreshingTokenProviderOptions): TokenProvider {
  const now = options.now ?? Date.now;
  const refreshSkewMs = options.refreshSkewMs ?? 60_000;

  return {
    async getAccessToken() {
      const tokens = await options.store.readTokens(options.userId);
      if (!tokens) {
        throw new Error('No Google tokens stored for user.');
      }

      if (!shouldRefresh(tokens, now(), refreshSkewMs)) {
        return tokens.accessToken;
      }

      const refreshed = await options.tokenClient.refreshTokens(tokens.refreshToken);
      await options.store.saveTokens(options.userId, refreshed);
      return refreshed.accessToken;
    }
  };
}

function shouldRefresh(tokens: GoogleTokenSet, now: number, refreshSkewMs: number): boolean {
  return tokens.expiresAt - now <= refreshSkewMs;
}
