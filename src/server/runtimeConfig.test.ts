import { describe, expect, it } from 'vitest';
import { publicBackendRoutes } from '../api/publicContract';
import { defaultGoogleScopes, loadBrainDumpBackendConfig, parseScopes, requiredEnv } from './runtimeConfig';

describe('runtime config', () => {
  it('loads backend config from environment values', () => {
    const config = loadBrainDumpBackendConfig({
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      BRAIN_DUMP_PUBLIC_API_ORIGIN: 'https://api.example.com/',
      BRAIN_DUMP_STORAGE_PREFIX: 'prod',
      GOOGLE_OAUTH_SCOPES: 'openid,email https://www.googleapis.com/auth/tasks'
    });

    expect(config.googleOAuth).toEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: `https://api.example.com${publicBackendRoutes.googleCallback}`,
      scopes: ['openid', 'email', 'https://www.googleapis.com/auth/tasks']
    });
    expect(config.storageKeyPrefix).toBe('prod');
  });

  it('uses the default public scopes when none are supplied', () => {
    expect(parseScopes(undefined)).toEqual([...defaultGoogleScopes]);
    expect(parseScopes('')).toEqual([...defaultGoogleScopes]);
  });

  it('reports missing required environment values clearly', () => {
    expect(() => requiredEnv({}, 'GOOGLE_CLIENT_ID')).toThrow('Missing required environment variable: GOOGLE_CLIENT_ID');
  });

  it('preserves a backend path prefix in the public API origin', () => {
    const config = loadBrainDumpBackendConfig({
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      BRAIN_DUMP_PUBLIC_API_ORIGIN: 'https://example.com/brain-dump-api/'
    });

    expect(config.googleOAuth.redirectUri).toBe(`https://example.com/brain-dump-api${publicBackendRoutes.googleCallback}`);
  });
});
