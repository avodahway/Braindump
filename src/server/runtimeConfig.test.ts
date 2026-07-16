import { describe, expect, it } from 'vitest';
import { publicBackendRoutes } from '../api/publicContract';
import { defaultGoogleScopes, loadBrainDumpBackendConfig, optionalPositiveInteger, parseScopes, requiredEnv } from './runtimeConfig';

describe('runtime config', () => {
  it('loads backend config from environment values', () => {
    const config = loadBrainDumpBackendConfig({
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      BRAIN_DUMP_PUBLIC_API_ORIGIN: 'https://api.example.com/',
      BRAIN_DUMP_FRONTEND_ORIGIN: 'https://braindump.example.com/',
      BRAIN_DUMP_ADMIN_TOKEN: 'admin-secret',
      BRAIN_DUMP_BETA_ACCESS_CODE: 'founder-beta',
      BRAIN_DUMP_STORAGE_PREFIX: 'prod',
      BRAIN_DUMP_MAX_JSON_BODY_BYTES: '32768',
      BRAIN_DUMP_RATE_LIMIT_WINDOW_MS: '120000',
      BRAIN_DUMP_RATE_LIMIT_MAX_REQUESTS: '30',
      GOOGLE_OAUTH_SCOPES: 'openid,email https://www.googleapis.com/auth/tasks'
    });

    expect(config.googleOAuth).toEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: `https://api.example.com${publicBackendRoutes.googleCallback}`,
      scopes: ['openid', 'email', 'https://www.googleapis.com/auth/tasks']
    });
    expect(config.frontendAppUrl).toBe('https://braindump.example.com/app');
    expect(config.adminToken).toBe('admin-secret');
    expect(config.betaAccessCode).toBe('founder-beta');
    expect(config.storageKeyPrefix).toBe('prod');
    expect(config.requestLimits).toEqual({
      maxJsonBodyBytes: 32768,
      rateLimit: {
        windowMs: 120000,
        maxRequests: 30
      }
    });
  });

  it('uses the default public scopes when none are supplied', () => {
    expect(parseScopes(undefined)).toEqual([...defaultGoogleScopes]);
    expect(parseScopes('')).toEqual([...defaultGoogleScopes]);
  });

  it('reports missing required environment values clearly', () => {
    expect(() => requiredEnv({}, 'GOOGLE_CLIENT_ID')).toThrow('Missing required environment variable: GOOGLE_CLIENT_ID');
  });

  it('parses optional positive integer environment values', () => {
    expect(optionalPositiveInteger(undefined, 'LIMIT')).toBeUndefined();
    expect(optionalPositiveInteger(' 42 ', 'LIMIT')).toBe(42);
    expect(() => optionalPositiveInteger('0', 'LIMIT')).toThrow('Invalid LIMIT value: 0');
    expect(() => optionalPositiveInteger('1.5', 'LIMIT')).toThrow('Invalid LIMIT value: 1.5');
  });

  it('preserves a backend path prefix in the public API origin', () => {
    const config = loadBrainDumpBackendConfig({
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      BRAIN_DUMP_PUBLIC_API_ORIGIN: 'https://example.com/brain-dump-api/'
    });

    expect(config.googleOAuth.redirectUri).toBe(`https://example.com/brain-dump-api${publicBackendRoutes.googleCallback}`);
  });

  it('configures Supabase storage when Supabase env values are present', async () => {
    const fetcher = async () => new Response(JSON.stringify([{ value: 'stored' }]));
    const config = loadBrainDumpBackendConfig(
      {
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
        BRAIN_DUMP_PUBLIC_API_ORIGIN: 'https://api.example.com',
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key',
        SUPABASE_KV_TABLE: 'brain_dump_kv',
        BRAIN_DUMP_STORAGE_SECRET: '0123456789abcdef0123456789abcdef'
      },
      { fetcher }
    );

    await expect(config.storage?.get('key')).resolves.toBe('stored');
    await expect(config.storageCodec?.decode(await config.storageCodec.encode('secret-value'))).resolves.toBe('secret-value');
  });

  it('requires both Supabase env values when one is provided', () => {
    expect(() =>
      loadBrainDumpBackendConfig({
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
        BRAIN_DUMP_PUBLIC_API_ORIGIN: 'https://api.example.com',
        SUPABASE_URL: 'https://project.supabase.co'
      })
    ).toThrow('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  });
});
