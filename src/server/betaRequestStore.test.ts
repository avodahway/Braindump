import { describe, expect, it } from 'vitest';
import { createMemoryKeyValueStore } from './durableStore';
import { createDurableBetaRequestStore, createMemoryBetaRequestStore } from './betaRequestStore';

describe('beta request store', () => {
  it('reads memory beta requests newest first', async () => {
    const store = createMemoryBetaRequestStore();

    await store.append(betaRequest('older', 'older@example.com', '2026-07-17T10:00:00.000Z'));
    await store.append(betaRequest('newer', 'newer@example.com', '2026-07-17T11:00:00.000Z'));

    expect((await store.readRecent()).map((request) => request.id)).toEqual(['newer', 'older']);
  });

  it('persists durable beta requests and replaces duplicate emails', async () => {
    const keyValueStore = createMemoryKeyValueStore();
    const store = createDurableBetaRequestStore(keyValueStore, { keyPrefix: 'test' });

    await store.append(betaRequest('first', 'user@example.com', '2026-07-17T10:00:00.000Z'));
    await store.append(betaRequest('updated', 'USER@example.com', '2026-07-17T11:00:00.000Z'));

    const requests = await store.readRecent();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ id: 'updated', email: 'USER@example.com' });
  });
});

function betaRequest(id: string, email: string, createdAt: string) {
  return {
    id,
    status: 'new' as const,
    name: id,
    email,
    tools: 'Google Tasks',
    googleComfort: 'comfortable',
    createdAt
  };
}
