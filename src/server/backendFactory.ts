import type { GoogleOAuthConfig } from './publicBackend';
import { createPublicBackend } from './publicBackend';
import type { ActionExecutor } from './actionExecutor';
import { createGoogleActionExecutor } from './googleExecutor';
import { createGoogleOAuthClient } from './googleOAuthClient';
import { createGoogleRestProviderClients } from './googleProviderClients';
import { createMemoryOAuthStore, type OAuthSessionStore, type TokenExchangeClient } from './oauthSession';
import { createRefreshingTokenProvider } from './refreshingTokenProvider';
import { createMemorySessionStore, type SessionStore } from './sessionStore';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type BrainDumpBackendConfig = {
  googleOAuth: GoogleOAuthConfig & {
    clientSecret: string;
  };
  fetcher?: Fetcher;
  nowMs?: () => number;
  nowDate?: () => Date;
  oauthStore?: OAuthSessionStore;
  sessionStore?: SessionStore;
  tokenClient?: TokenExchangeClient;
  executor?: ActionExecutor;
};

export function createBrainDumpBackend(config: BrainDumpBackendConfig) {
  const oauthStore = config.oauthStore ?? createMemoryOAuthStore();
  const sessionStore = config.sessionStore ?? createMemorySessionStore(config.nowMs);
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

  return createPublicBackend({
    googleOAuth: config.googleOAuth,
    oauthStore,
    sessionStore,
    tokenClient,
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
