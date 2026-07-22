import { describe, expect, it } from 'vitest';
import { createMemoryKeyValueStore } from './durableStore';
import { createDurableSupportRequestStore, createMemorySupportRequestStore } from './supportRequestStore';

describe('support request store', () => {
  it('reads memory support requests newest first', async () => {
    const store = createMemorySupportRequestStore();
    await store.append(supportRequest('older', '2026-07-17T10:00:00.000Z'));
    await store.append(supportRequest('newer', '2026-07-17T11:00:00.000Z'));
    expect((await store.readRecent()).map((record) => record.id)).toEqual(['newer', 'older']);
  });

  it('updates durable support request status', async () => {
    const keyValueStore = createMemoryKeyValueStore();
    const store = createDurableSupportRequestStore(keyValueStore, { keyPrefix: 'test' });
    await store.append(supportRequest('first', '2026-07-17T10:00:00.000Z'));
    await expect(store.updateStatus('first', 'resolved', '2026-07-17T11:00:00.000Z')).resolves.toMatchObject({
      id: 'first',
      status: 'resolved',
      updatedAt: '2026-07-17T11:00:00.000Z'
    });
  });
});

function supportRequest(id: string, createdAt: string) {
  return {
    id,
    status: 'new' as const,
    email: `${id}@example.com`,
    issueType: 'google_connection',
    summary: 'Connection failed',
    details: 'OAuth callback showed an error.',
    createdAt
  };
}
