import { describe, expect, it } from 'vitest';
import type { BrainDumpResponse } from '../lib/types';
import { createMemoryKeyValueStore, type SecretCodec } from './durableStore';
import { createDurableResponseStore, createMemoryResponseStore } from './idempotencyStore';

describe('idempotency response store', () => {
  it('stores responses in memory', async () => {
    const store = createMemoryResponseStore();
    const response = brainDumpResponse('req-1');

    await store.saveResponse('req-1', response);

    expect(await store.readResponse('req-1')).toEqual(response);
    await store.clear();
    expect(await store.readResponse('req-1')).toBeUndefined();
  });

  it('stores responses through a durable key-value store', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createDurableResponseStore(kv, { keyPrefix: 'test' });
    const response = brainDumpResponse('REQ-1');

    await store.saveResponse('REQ-1', response);

    expect(await store.readResponse('req-1')).toEqual(response);
    expect([...kv.values.keys()][0]).toBe('test:brain-dump-response:req-1');
  });

  it('uses the supplied codec before writing responses', async () => {
    const kv = createMemoryKeyValueStore();
    const codec: SecretCodec = {
      async encode(value) {
        return `encoded:${value}`;
      },
      async decode(value) {
        return value.replace(/^encoded:/, '');
      }
    };
    const store = createDurableResponseStore(kv, { keyPrefix: 'test', codec });

    await store.saveResponse('req-1', brainDumpResponse('req-1'));

    expect([...kv.values.values()][0]).toMatch(/^encoded:/);
    expect(await store.readResponse('req-1')).toMatchObject({ requestId: 'req-1' });
  });

  it('deletes only one user responses from memory', async () => {
    const store = createMemoryResponseStore();

    await store.saveResponse('req-1', brainDumpResponse('req-1'), 'user@example.com');
    await store.saveResponse('req-2', brainDumpResponse('req-2'), 'other@example.com');
    await store.deleteByUser('USER@example.com');

    expect(await store.readResponse('req-1')).toBeUndefined();
    expect(await store.readResponse('req-2')).toMatchObject({ requestId: 'req-2' });
  });

  it('deletes durable responses from a user index', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createDurableResponseStore(kv, { keyPrefix: 'test' });

    await store.saveResponse('req-1', brainDumpResponse('req-1'), 'user@example.com');
    await store.saveResponse('req-2', brainDumpResponse('req-2'), 'other@example.com');
    await store.deleteByUser('user@example.com');

    expect(await store.readResponse('req-1')).toBeUndefined();
    expect(await store.readResponse('req-2')).toMatchObject({ requestId: 'req-2' });
    expect(kv.values.has('test:brain-dump-response-index:user@example.com')).toBe(false);
  });
});

function brainDumpResponse(requestId: string): BrainDumpResponse {
  return {
    ok: true,
    requestId,
    summary: {
      calendar: 0,
      workTasks: 0,
      personalTasks: 1,
      projects: 0,
      waiting: 0,
      needsReview: 0
    },
    actions: [
      {
        type: 'personal_task',
        title: 'Buy coffee',
        status: 'created',
        sourceText: 'Buy coffee'
      }
    ],
    errors: []
  };
}
