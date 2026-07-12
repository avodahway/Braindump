import type { GoogleOAuthConfig } from './publicBackend';
import type { GoogleProfile, GoogleTokenSet, TokenExchangeClient } from './oauthSession';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type GoogleOAuthClientConfig = GoogleOAuthConfig & {
  clientSecret: string;
};

export function createGoogleOAuthClient(
  config: GoogleOAuthClientConfig,
  fetcher: Fetcher = fetch,
  now: () => number = Date.now
): TokenExchangeClient {
  return {
    async exchangeCode(code) {
      const body = new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code'
      });

      const response = await fetcher('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      });

      if (!response.ok) {
        throw new Error(`Google token exchange returned ${response.status}`);
      }

      return toTokenSet(await response.json(), now());
    },

    async refreshTokens(refreshToken) {
      const body = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token'
      });

      const response = await fetcher('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      });

      if (!response.ok) {
        throw new Error(`Google token refresh returned ${response.status}`);
      }

      return toTokenSet(await response.json(), now(), refreshToken);
    },

    async readProfile(tokens) {
      const response = await fetcher('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Google profile lookup returned ${response.status}`);
      }

      return toProfile(await response.json());
    }
  };
}

function toTokenSet(value: unknown, now: number, fallbackRefreshToken?: string): GoogleTokenSet {
  if (!isRecord(value) || typeof value.access_token !== 'string') {
    throw new Error('Google token response did not include an access token.');
  }

  if (typeof value.refresh_token !== 'string' && !fallbackRefreshToken) {
    throw new Error('Google token response did not include a refresh token.');
  }

  const expiresIn = typeof value.expires_in === 'number' ? value.expires_in : 3600;
  const scope = typeof value.scope === 'string' ? value.scope : '';

  const refreshToken = typeof value.refresh_token === 'string' ? value.refresh_token : fallbackRefreshToken;
  if (!refreshToken) {
    throw new Error('Google token response did not include a refresh token.');
  }

  return {
    accessToken: value.access_token,
    refreshToken,
    expiresAt: now + expiresIn * 1000,
    scope
  };
}

function toProfile(value: unknown): GoogleProfile {
  if (!isRecord(value) || typeof value.email !== 'string') {
    throw new Error('Google profile response did not include an email.');
  }

  return {
    email: value.email,
    name: typeof value.name === 'string' ? value.name : undefined
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
