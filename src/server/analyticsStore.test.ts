import { describe, expect, it } from 'vitest';
import { createMemoryKeyValueStore } from './durableStore';
import { createDurableAnalyticsStore, createMemoryAnalyticsStore, sanitizeAnalyticsEvent } from './analyticsStore';

describe('analytics store', () => {
  it('stores privacy-safe event records in memory', async () => {
    const store = createMemoryAnalyticsStore();

    await store.append({
      name: 'review_created',
      requestId: 'req-1',
      actionCount: 2,
      createdAt: '2026-07-12T12:00:00.000Z'
    });

    expect(await store.readAll()).toEqual([
      {
        name: 'review_created',
        requestId: 'req-1',
        actionCount: 2,
        createdAt: '2026-07-12T12:00:00.000Z'
      }
    ]);
  });

  it('persists events through durable storage', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createDurableAnalyticsStore(kv, { keyPrefix: 'test' });

    await store.append({
      name: 'create_completed',
      requestId: 'req-1',
      createdAt: '2026-07-12T12:00:00.000Z'
    });

    expect(await store.readAll()).toMatchObject([{ name: 'create_completed', requestId: 'req-1' }]);
  });

  it('sanitizes submitted events and drops text-like fields', () => {
    expect(
      sanitizeAnalyticsEvent({
        name: 'review_created',
        requestId: 'req-1',
        text: 'Pay employees tomorrow',
        sourceText: 'Pay employees tomorrow',
        actionCount: 1
      })
    ).toEqual({
      name: 'review_created',
      requestId: 'req-1',
      actionCount: 1
    });

    expect(sanitizeAnalyticsEvent({ name: 'unknown' })).toBeUndefined();
  });
});
