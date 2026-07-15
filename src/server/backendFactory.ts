import type { GoogleOAuthConfig, PublicRequestLimits } from './publicBackend';
import { createPublicBackend } from './publicBackend';
import type { ActionExecutor } from './actionExecutor';
import {
  createDurableOAuthStore,
  createDurableSessionStore,
  type KeyValueStore,
  type SecretCodec
} from './durableStore';
import { createGoogleActionExecutor } from './googleExecutor';
import { createGoogleOAuthClient } from './googleOAuthClient';
import { createGoogleRestProviderClients } from './googleProviderClients';
import {
  createMemoryOAuthStore,
  type OAuthSessionStore,
  type TokenExchangeClient,
  type WorkspaceProvisioner
} from './oauthSession';
import { createRefreshingTokenProvider } from './refreshingTokenProvider';
import { createMemorySessionStore, type SessionStore } from './sessionStore';
import { createGoogleWorkspaceProvisioner } from './workspaceProvisioning';
import { createDurableResponseStore, createMemoryResponseStore, type ResponseStore } from './idempotencyStore';
import {
  createDurableExecutionLogStore,
  createMemoryExecutionLogStore,
  type ExecutionLogStore
} from './executionLogStore';
import { createDurableAnalyticsStore, createMemoryAnalyticsStore, type AnalyticsStore } from './analyticsStore';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type BrainDumpBackendConfig = {
  googleOAuth: GoogleOAuthConfig & {
    clientSecret: string;
  };
  frontendAppUrl?: string;
  fetcher?: Fetcher;
  nowMs?: () => number;
  nowDate?: () => Date;
  oauthStore?: OAuthSessionStore;
  sessionStore?: SessionStore;
  storage?: KeyValueStore;
  storageCodec?: SecretCodec;
  storageKeyPrefix?: string;
  tokenClient?: TokenExchangeClient;
  workspaceProvisioner?: WorkspaceProvisioner;
  responseStore?: ResponseStore;
  executionLogStore?: ExecutionLogStore;
  analyticsStore?: AnalyticsStore;
  adminToken?: string;
  requestLimits?: PublicRequestLimits;
  executor?: ActionExecutor;
};

export function createBrainDumpBackend(config: BrainDumpBackendConfig) {
  const oauthStore =
    config.oauthStore ??
    (config.storage
      ? createDurableOAuthStore(config.storage, {
          keyPrefix: config.storageKeyPrefix,
          codec: config.storageCodec
        })
      : createMemoryOAuthStore());
  const sessionStore =
    config.sessionStore ??
    (config.storage
      ? createDurableSessionStore(config.storage, {
          keyPrefix: config.storageKeyPrefix,
          codec: config.storageCodec,
          now: config.nowMs
        })
      : createMemorySessionStore(config.nowMs));
  const responseStore =
    config.responseStore ??
    (config.storage
      ? createDurableResponseStore(config.storage, {
          keyPrefix: config.storageKeyPrefix,
          codec: config.storageCodec
      })
      : createMemoryResponseStore());
  const executionLogStore =
    config.executionLogStore ??
    (config.storage
      ? createDurableExecutionLogStore(config.storage, {
          keyPrefix: config.storageKeyPrefix,
          codec: config.storageCodec
        })
      : createMemoryExecutionLogStore());
  const analyticsStore =
    config.analyticsStore ??
    (config.storage
      ? createDurableAnalyticsStore(config.storage, {
          keyPrefix: config.storageKeyPrefix,
          codec: config.storageCodec
        })
      : createMemoryAnalyticsStore());
  const tokenClient =
    config.tokenClient ??
    createGoogleOAuthClient(
      {
        clientId: config.googleOAuth.clientId,
        clientSecret: config.googleOAuth.clientSecret,
        redirectUri: config.googleOAuth.redirectUri,
        scopes: config.googleOAuth.scopes
      },
      config.fetcher,
      config.nowMs
    );
  const executor =
    config.executor ??
    createGoogleBackedExecutor({
      oauthStore,
      tokenClient,
      fetcher: config.fetcher,
      nowMs: config.nowMs,
      nowDate: config.nowDate
    });
  const workspaceProvisioner =
    config.workspaceProvisioner ?? createGoogleWorkspaceProvisioner({ fetcher: config.fetcher });

  return createPublicBackend({
    googleOAuth: config.googleOAuth,
    frontendAppUrl: config.frontendAppUrl,
    oauthStore,
    sessionStore,
    tokenClient,
    workspaceProvisioner,
    responseStore,
    executionLogStore,
    analyticsStore,
    adminToken: config.adminToken,
    storageKeyPrefix: config.storageKeyPrefix,
    storageMode: config.storage ? 'durable' : 'memory',
    storageEncrypted: Boolean(config.storageCodec),
    requestLimits: config.requestLimits,
    now: config.nowDate,
    executor
  });
}

export type GoogleBackedExecutorOptions = {
  oauthStore: OAuthSessionStore;
  tokenClient: TokenExchangeClient;
  fetcher?: Fetcher;
  nowMs?: () => number;
  nowDate?: () => Date;
};

export function createGoogleBackedExecutor(options: GoogleBackedExecutorOptions): ActionExecutor {
  return {
    execute(action, workspace, context) {
      const userId = context?.userId ?? workspace.email?.toLowerCase();
      if (!userId) {
        return Promise.resolve({
          status: 'error',
          message: 'No signed-in Google user is available for this request.'
        });
      }

      const tokenProvider = createRefreshingTokenProvider({
        userId,
        store: options.oauthStore,
        tokenClient: options.tokenClient,
        now: options.nowMs
      });
      const executor = createGoogleActionExecutor(
        createGoogleRestProviderClients({
          tokenProvider,
          fetcher: options.fetcher,
          now: options.nowDate
        })
      );

      return executor.execute(action, workspace, context);
    }
  };
}
