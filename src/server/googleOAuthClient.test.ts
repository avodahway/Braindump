import { describe, expect, it, vi } from 'vitest';
import { createGoogleOAuthClient } from './googleOAuthClient';

const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://api.example.com/api/auth/google/callback',
  scopes: ['openid', 'email']
};

describe('Google OAuth client', () => {
  it('exchanges an auth code for normalized tokens', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 1800,
          scope: 'openid email'
        })
      )
    );

    const tokens = await createGoogleOAuthClient(config, fetcher, () => 1000).exchangeCode('auth-code');

    expect(tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 1801000,
      scope: 'openid email'
    });

    const [, init] = fetcher.mock.calls[0];
    expect(fetcher.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(String(init.body)).toContain('client_secret=client-secret');
    expect(String(init.body)).toContain('grant_type=authorization_code');
  });

  it('reads the Google profile with the access token', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          email: 'person@example.com',
          name: 'Person Example'
        })
      )
    );

    const profile = await createGoogleOAuthClient(config, fetcher).readProfile({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 2000,
      scope: 'openid email'
    });

    expect(profile).toEqual({ email: 'person@example.com', name: 'Person Example' });
    expect(fetcher).toHaveBeenCalledWith('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: 'Bearer access-token'
      }
    });
  });

  it('refreshes tokens while preserving refresh token when Google omits it', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'new-access-token',
          expires_in: 900,
          scope: 'openid email'
        })
      )
    );

    const tokens = await createGoogleOAuthClient(config, fetcher, () => 1000).refreshTokens('existing-refresh-token');

    expect(tokens).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'existing-refresh-token',
      expiresAt: 901000,
      scope: 'openid email'
    });
    expect(String(fetcher.mock.calls[0][1].body)).toContain('grant_type=refresh_token');
    expect(String(fetcher.mock.calls[0][1].body)).toContain('refresh_token=existing-refresh-token');
  });

  it('raises token refresh errors', async () => {
    await expect(
      createGoogleOAuthClient(config, vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))).refreshTokens('refresh')
    ).rejects.toThrow('Google token refresh returned 401');
  });

  it('raises token exchange and profile lookup errors', async () => {
    await expect(
      createGoogleOAuthClient(config, vi.fn().mockResolvedValue(new Response('{}', { status: 400 }))).exchangeCode('bad')
    ).rejects.toThrow('Google token exchange returned 400');

    await expect(
      createGoogleOAuthClient(config, vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))).readProfile({
        accessToken: 'bad',
        refreshToken: 'refresh',
        expiresAt: 2000,
        scope: ''
      })
    ).rejects.toThrow('Google profile lookup returned 401');
  });

  it('validates required Google response fields', async () => {
    await expect(
      createGoogleOAuthClient(config, vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'access' })))).exchangeCode(
        'code'
      )
    ).rejects.toThrow('Google token response did not include a refresh token.');

    await expect(
      createGoogleOAuthClient(config, vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: 'No Email' })))).readProfile({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: 2000,
        scope: ''
      })
    ).rejects.toThrow('Google profile response did not include an email.');
  });
});
