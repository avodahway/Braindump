import { describe, expect, it } from 'vitest';
import { createMemoryKeyValueStore } from './durableStore';
import { createDurableFeedbackStore, createMemoryFeedbackStore } from './feedbackStore';

describe('feedback store', () => {
  it('reads memory feedback newest first', async () => {
    const store = createMemoryFeedbackStore();

    await store.append(feedback('older', '2026-07-17T10:00:00.000Z'));
    await store.append(feedback('newer', '2026-07-17T11:00:00.000Z'));

    expect((await store.readRecent()).map((record) => record.id)).toEqual(['newer', 'older']);
  });

  it('persists durable feedback newest first', async () => {
    const keyValueStore = createMemoryKeyValueStore();
    const store = createDurableFeedbackStore(keyValueStore, { keyPrefix: 'test' });

    await store.append(feedback('older', '2026-07-17T10:00:00.000Z'));
    await store.append(feedback('newer', '2026-07-17T11:00:00.000Z'));

    expect((await store.readRecent()).map((record) => record.id)).toEqual(['newer', 'older']);
  });
});

function feedback(id: string, createdAt: string) {
  return {
    id,
    status: 'new' as const,
    email: `${id}@example.com`,
    lookedRight: 'The task preview was clear.',
    confusing: 'The calendar copy was unclear.',
    expected: 'I expected a review step.',
    createdAt
  };
}
