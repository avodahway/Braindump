import type { UserWorkspace } from '../lib/types';
import type { GoogleTokenSet, OAuthSessionStore, OAuthStateRecord } from './oauthSession';
import { createSessionId, type SessionRecord, type SessionStore } from './sessionStore';

export type KeyValueStore = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
};

export type SecretCodec = {
  encode(value: string): Promise<string>;
  decode(value: string): Promise<string>;
};

export type DurableStoreOptions = {
  keyPrefix?: string;
  codec?: SecretCodec;
};

export function createMemoryKeyValueStore(): KeyValueStore & { values: Map<string, string> } {
  const values = new Map<string, string>();

  return {
    values,
    async get(key) {
      return values.get(key);
    },
    async set(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      values.delete(key);
    }
  };
}

export function createPlainTextCodec(): SecretCodec {
  return {
    async encode(value) {
      return value;
    },
    async decode(value) {
      return value;
    }
  };
}

export function createDurableOAuthStore(
  store: KeyValueStore,
  options: DurableStoreOptions = {}
): OAuthSessionStore {
  const codec = options.codec ?? createPlainTextCodec();
  const prefix = options.keyPrefix ?? 'brain-dump';

  return {
    async saveState(record) {
      await writeJson(store, codec, key(prefix, 'oauth-state', record.state), record);
    },
    async consumeState(state) {
      const stateKey = key(prefix, 'oauth-state', state);
      const record = await readJson<OAuthStateRecord>(store, codec, stateKey, isOAuthStateRecord);
      await store.delete(stateKey);
      return record;
    },
    async readTokens(userId) {
      return readJson<GoogleTokenSet>(store, codec, key(prefix, 'google-tokens', userId), isGoogleTokenSet);
    },
    async saveTokens(userId, tokens) {
      await writeJson(store, codec, key(prefix, 'google-tokens', userId), tokens);
    },
    async readWorkspace(userId) {
      return readJson<UserWorkspace>(store, codec, key(prefix, 'workspace', userId), isUserWorkspace);
    },
    async saveWorkspace(userId, workspace) {
      await writeJson(store, codec, key(prefix, 'workspace', userId), workspace);
    },
    async deleteConnection(userId) {
      await store.delete(key(prefix, 'google-tokens', userId));
      await store.delete(key(prefix, 'workspace', userId));
    }
  };
}

export function createDurableSessionStore(
  store: KeyValueStore,
  options: DurableStoreOptions & { now?: () => number } = {}
): SessionStore {
  const codec = options.codec ?? createPlainTextCodec();
  const prefix = options.keyPrefix ?? 'brain-dump';
  const now = options.now ?? Date.now;

  return {
    async createSession(userId) {
      const session = {
        id: createSessionId(),
        userId,
        createdAt: now()
      };
      await writeJson(store, codec, key(prefix, 'session', session.id), session);
      return session;
    },
    async readSession(sessionId) {
      return readJson<SessionRecord>(store, codec, key(prefix, 'session', sessionId), isSessionRecord);
    },
    async deleteSession(sessionId) {
      await store.delete(key(prefix, 'session', sessionId));
    }
  };
}

async function writeJson(store: KeyValueStore, codec: SecretCodec, keyName: string, value: unknown): Promise<void> {
  await store.set(keyName, await codec.encode(JSON.stringify(value)));
}

async function readJson<T>(
  store: KeyValueStore,
  codec: SecretCodec,
  keyName: string,
  guard: (value: unknown) => value is T
): Promise<T | undefined> {
  const raw = await store.get(keyName);
  if (!raw) return undefined;

  try {
    const value = JSON.parse(await codec.decode(raw));
    return guard(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function key(prefix: string, scope: string, id: string): string {
  return `${prefix}:${scope}:${id.toLowerCase()}`;
}

function isOAuthStateRecord(value: unknown): value is OAuthStateRecord {
  return isRecord(value) && typeof value.state === 'string' && typeof value.createdAt === 'number';
}

function isGoogleTokenSet(value: unknown): value is GoogleTokenSet {
  return (
    isRecord(value) &&
    typeof value.accessToken === 'string' &&
    typeof value.refreshToken === 'string' &&
    typeof value.expiresAt === 'number' &&
    typeof value.scope === 'string'
  );
}

function isUserWorkspace(value: unknown): value is UserWorkspace {
  return isRecord(value) && typeof value.status === 'string' && Array.isArray(value.destinations);
}

function isSessionRecord(value: unknown): value is SessionRecord {
  return isRecord(value) && typeof value.id === 'string' && typeof value.userId === 'string' && typeof value.createdAt === 'number';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
