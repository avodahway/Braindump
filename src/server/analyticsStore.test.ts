import { describe, expect, it } from 'vitest';
import { createMemoryKeyValueStore } from './durableStore';
import { createDurableAnalyticsStore, createMemoryAnalyticsStore, sanitizeAnalyticsEvent, summarizeAnalytics } from './analyticsStore';

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

  it('deletes one user analytics events from memory', async () => {
    const store = createMemoryAnalyticsStore();

    await store.append({
      name: 'create_completed',
      requestId: 'req-1',
      userId: 'user@example.com',
      createdAt: '2026-07-12T12:00:00.000Z'
    });
    await store.append({
      name: 'create_completed',
      requestId: 'req-2',
      userId: 'other@example.com',
      createdAt: '2026-07-12T12:01:00.000Z'
    });

    await store.deleteByUser('USER@example.com');

    expect(await store.readAll()).toMatchObject([{ requestId: 'req-2' }]);
  });

  it('deletes one user analytics events from durable storage', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createDurableAnalyticsStore(kv, { keyPrefix: 'test' });

    await store.append({
      name: 'create_completed',
      requestId: 'req-1',
      userId: 'user@example.com',
      createdAt: '2026-07-12T12:00:00.000Z'
    });
    await store.append({
      name: 'create_completed',
      requestId: 'req-2',
      userId: 'other@example.com',
      createdAt: '2026-07-12T12:01:00.000Z'
    });

    await store.deleteByUser('user@example.com');

    expect(await store.readAll()).toMatchObject([{ requestId: 'req-2' }]);
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

  it('summarizes event counts without exposing event payload text', () => {
    expect(
      summarizeAnalytics([
        {
          name: 'review_created',
          requestId: 'req-1',
          userId: 'user@example.com',
          actionCount: 3,
          createdAt: '2026-07-12T12:00:00.000Z'
        },
        {
          name: 'create_failed',
          requestId: 'req-1',
          userId: 'user@example.com',
          errorCount: 1,
          createdAt: '2026-07-12T12:01:00.000Z'
        }
      ])
    ).toEqual({
      totalEvents: 2,
      uniqueUsers: 1,
      uniqueRequests: 1,
      totalActions: 3,
      totalErrors: 1,
      byName: {
        review_created: 1,
        create_failed: 1
      },
      latestEventAt: '2026-07-12T12:01:00.000Z'
    });
  });
});
