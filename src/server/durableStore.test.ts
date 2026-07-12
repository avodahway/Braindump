import { describe, expect, it } from 'vitest';
import { defaultWorkspace } from './oauthSession';
import {
  createDurableOAuthStore,
  createDurableSessionStore,
  createMemoryKeyValueStore,
  type SecretCodec
} from './durableStore';

describe('durable store adapters', () => {
  it('persists OAuth state, tokens, and workspace records through a key-value store', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createDurableOAuthStore(kv, { keyPrefix: 'test' });
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 1234,
      scope: 'openid email'
    };
    const workspace = defaultWorkspace('user@example.com');

    await store.saveState({ state: 'oauth-state', createdAt: 1000 });
    await store.saveTokens('USER@example.com', tokens);
    await store.saveWorkspace('USER@example.com', workspace);

    expect(await store.consumeState('oauth-state')).toEqual({ state: 'oauth-state', createdAt: 1000 });
    expect(await store.consumeState('oauth-state')).toBeUndefined();
    expect(await store.readTokens('user@example.com')).toEqual(tokens);
    expect(await store.readWorkspace('user@example.com')).toEqual(workspace);
  });

  it('persists sessions and deletes them', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createDurableSessionStore(kv, { keyPrefix: 'test', now: () => 2000 });

    const session = await store.createSession('user@example.com');

    expect(session.createdAt).toBe(2000);
    expect(await store.readSession(session.id)).toEqual(session);

    await store.deleteSession(session.id);
    expect(await store.readSession(session.id)).toBeUndefined();
  });

  it('uses the supplied codec before writing secrets', async () => {
    const kv = createMemoryKeyValueStore();
    const codec: SecretCodec = {
      async encode(value) {
        return `encoded:${value}`;
      },
      async decode(value) {
        return value.replace(/^encoded:/, '');
      }
    };
    const store = createDurableOAuthStore(kv, { keyPrefix: 'test', codec });

    await store.saveTokens('user@example.com', {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 1234,
      scope: 'openid email'
    });

    expect([...kv.values.values()][0]).toMatch(/^encoded:/);
    expect(await store.readTokens('user@example.com')).toMatchObject({ refreshToken: 'refresh-token' });
  });
});
