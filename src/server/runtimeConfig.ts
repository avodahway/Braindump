import { publicBackendRoutes } from '../api/publicContract';
import type { BrainDumpBackendConfig } from './backendFactory';
import { createAesGcmSecretCodec } from './storageCrypto';
import { createSupabaseKeyValueStore } from './supabaseKeyValueStore';

export type RuntimeEnv = Record<string, string | undefined>;

export type RuntimeConfigOptions = {
  fetcher?: BrainDumpBackendConfig['fetcher'];
  storage?: BrainDumpBackendConfig['storage'];
  storageCodec?: BrainDumpBackendConfig['storageCodec'];
  nowMs?: BrainDumpBackendConfig['nowMs'];
  nowDate?: BrainDumpBackendConfig['nowDate'];
};

export const defaultGoogleScopes = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events'
] as const;

export function loadBrainDumpBackendConfig(
  env: RuntimeEnv,
  options: RuntimeConfigOptions = {}
): BrainDumpBackendConfig {
  const clientId = requiredEnv(env, 'GOOGLE_CLIENT_ID');
  const clientSecret = requiredEnv(env, 'GOOGLE_CLIENT_SECRET');
  const publicApiOrigin = normalizeOrigin(requiredEnv(env, 'BRAIN_DUMP_PUBLIC_API_ORIGIN'));
  const scopes = parseScopes(env.GOOGLE_OAUTH_SCOPES);

  return {
    googleOAuth: {
      clientId,
      clientSecret,
      redirectUri: `${publicApiOrigin}${publicBackendRoutes.googleCallback}`,
      scopes
    },
    frontendAppUrl: frontendAppUrl(env.BRAIN_DUMP_FRONTEND_ORIGIN),
    adminToken: env.BRAIN_DUMP_ADMIN_TOKEN?.trim() || undefined,
    betaAccessCode: env.BRAIN_DUMP_BETA_ACCESS_CODE?.trim() || undefined,
    storageKeyPrefix: env.BRAIN_DUMP_STORAGE_PREFIX || 'brain-dump',
    requestLimits: requestLimits(env),
    fetcher: options.fetcher,
    storage: options.storage ?? supabaseStorage(env, options.fetcher),
    storageCodec: options.storageCodec ?? storageCodec(env),
    nowMs: options.nowMs,
    nowDate: options.nowDate
  };
}

function requestLimits(env: RuntimeEnv): BrainDumpBackendConfig['requestLimits'] {
  return {
    maxJsonBodyBytes: optionalPositiveInteger(env.BRAIN_DUMP_MAX_JSON_BODY_BYTES, 'BRAIN_DUMP_MAX_JSON_BODY_BYTES'),
    rateLimit: {
      windowMs: optionalPositiveInteger(env.BRAIN_DUMP_RATE_LIMIT_WINDOW_MS, 'BRAIN_DUMP_RATE_LIMIT_WINDOW_MS'),
      maxRequests: optionalPositiveInteger(env.BRAIN_DUMP_RATE_LIMIT_MAX_REQUESTS, 'BRAIN_DUMP_RATE_LIMIT_MAX_REQUESTS')
    }
  };
}

function storageCodec(env: RuntimeEnv): BrainDumpBackendConfig['storageCodec'] | undefined {
  const secret = env.BRAIN_DUMP_STORAGE_SECRET?.trim();
  return secret ? createAesGcmSecretCodec(secret) : undefined;
}

export function requiredEnv(env: RuntimeEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function parseScopes(value: string | undefined): string[] {
  const scopes = value
    ?.split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return scopes && scopes.length > 0 ? scopes : [...defaultGoogleScopes];
}

export function optionalPositiveInteger(value: string | undefined, name: string): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name} value: ${trimmed}`);
  }
  return parsed;
}

function normalizeOrigin(value: string): string {
  const withoutTrailingSlash = value.replace(/\/+$/, '');
  const url = new URL(withoutTrailingSlash);
  return url.origin === withoutTrailingSlash ? withoutTrailingSlash : `${url.origin}${url.pathname}`;
}

function frontendAppUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? `${normalizeOrigin(trimmed)}/app` : undefined;
}

function supabaseStorage(
  env: RuntimeEnv,
  fetcher: BrainDumpBackendConfig['fetcher']
): BrainDumpBackendConfig['storage'] | undefined {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl && !serviceRoleKey) return undefined;
  if (!supabaseUrl) throw new Error('Missing required environment variable: SUPABASE_URL');
  if (!serviceRoleKey) throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');

  return createSupabaseKeyValueStore({
    supabaseUrl,
    serviceRoleKey,
    tableName: env.SUPABASE_KV_TABLE?.trim() || undefined,
    fetcher
  });
}
