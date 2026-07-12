import type { UserWorkspace } from '../lib/types';
import { buildGoogleAuthorizationUrl, type GoogleOAuthConfig } from './publicBackend';

export type OAuthStateRecord = {
  state: string;
  createdAt: number;
  returnTo?: string;
};

export type GoogleTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
};

export type GoogleProfile = {
  email: string;
  name?: string;
};

export type TokenExchangeClient = {
  exchangeCode(code: string): Promise<GoogleTokenSet>;
  readProfile(tokens: GoogleTokenSet): Promise<GoogleProfile>;
};

export type OAuthSessionStore = {
  saveState(record: OAuthStateRecord): Promise<void>;
  consumeState(state: string): Promise<OAuthStateRecord | undefined>;
  saveTokens(userId: string, tokens: GoogleTokenSet): Promise<void>;
  saveWorkspace(userId: string, workspace: UserWorkspace): Promise<void>;
};

export type OAuthStartResult = {
  authorizationUrl: string;
  state: string;
};

export function createOAuthState(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function startOAuthSession(
  config: GoogleOAuthConfig,
  store: OAuthSessionStore,
  now = Date.now()
): Promise<OAuthStartResult> {
  const state = createOAuthState();
  await store.saveState({ state, createdAt: now });

  const authorization = new URL(buildGoogleAuthorizationUrl(config));
  authorization.searchParams.set('state', state);

  return {
    authorizationUrl: authorization.toString(),
    state
  };
}

export async function completeOAuthSession({
  code,
  state,
  store,
  tokenClient,
  now = Date.now()
}: {
  code: string;
  state: string;
  store: OAuthSessionStore;
  tokenClient: TokenExchangeClient;
  now?: number;
}): Promise<UserWorkspace> {
  const savedState = await store.consumeState(state);
  if (!savedState) {
    throw new Error('Invalid OAuth state.');
  }

  if (now - savedState.createdAt > 10 * 60 * 1000) {
    throw new Error('OAuth state expired.');
  }

  const tokens = await tokenClient.exchangeCode(code);
  const profile = await tokenClient.readProfile(tokens);
  const userId = profile.email.toLowerCase();
  const workspace = defaultWorkspace(profile.email);

  await store.saveTokens(userId, tokens);
  await store.saveWorkspace(userId, workspace);

  return workspace;
}

export function defaultWorkspace(email: string): UserWorkspace {
  return {
    status: 'connected',
    email,
    destinations: [
      {
        id: 'brain-dump-work',
        name: 'Brain Dump Work',
        provider: 'google_tasks',
        kind: 'work_tasks',
        isDefault: true
      },
      {
        id: 'brain-dump-personal',
        name: 'Brain Dump Personal',
        provider: 'google_tasks',
        kind: 'personal_tasks',
        isDefault: true
      },
      {
        id: 'primary',
        name: 'Primary Calendar',
        provider: 'google_calendar',
        kind: 'calendar',
        isDefault: true
      },
      {
        id: 'brain-dump-projects',
        name: 'Brain Dump Projects',
        provider: 'brain_dump_workspace',
        kind: 'projects',
        isDefault: true
      },
      {
        id: 'brain-dump-waiting',
        name: 'Brain Dump Waiting On',
        provider: 'brain_dump_workspace',
        kind: 'waiting',
        isDefault: true
      }
    ]
  };
}

export function createMemoryOAuthStore(): OAuthSessionStore & {
  states: Map<string, OAuthStateRecord>;
  tokens: Map<string, GoogleTokenSet>;
  workspaces: Map<string, UserWorkspace>;
} {
  const states = new Map<string, OAuthStateRecord>();
  const tokens = new Map<string, GoogleTokenSet>();
  const workspaces = new Map<string, UserWorkspace>();

  return {
    states,
    tokens,
    workspaces,
    async saveState(record) {
      states.set(record.state, record);
    },
    async consumeState(state) {
      const record = states.get(state);
      states.delete(state);
      return record;
    },
    async saveTokens(userId, tokenSet) {
      tokens.set(userId, tokenSet);
    },
    async saveWorkspace(userId, workspace) {
      workspaces.set(userId, workspace);
    }
  };
}
