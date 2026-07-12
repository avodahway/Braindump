import { describe, expect, it } from 'vitest';
import { createMemoryKeyValueStore, type SecretCodec } from './durableStore';
import {
  createDurableExecutionLogStore,
  createMemoryExecutionLogStore,
  type ExecutionLogRecord
} from './executionLogStore';

describe('execution log store', () => {
  it('keeps in-memory action logs by request id', async () => {
    const store = createMemoryExecutionLogStore();
    const record = logRecord('req-1');

    await store.append(record);

    expect(await store.readByRequest('req-1')).toEqual([record]);
    await store.clear();
    expect(await store.readByRequest('req-1')).toEqual([]);
  });

  it('persists action logs through durable storage', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createDurableExecutionLogStore(kv, { keyPrefix: 'test' });

    await store.append(logRecord('REQ-1'));
    await store.append({ ...logRecord('REQ-1'), title: 'Second task' });

    expect(await store.readByRequest('req-1')).toHaveLength(2);
    expect([...kv.values.keys()][0]).toBe('test:execution-log:req-1');
  });

  it('uses the supplied codec before writing logs', async () => {
    const kv = createMemoryKeyValueStore();
    const codec: SecretCodec = {
      async encode(value) {
        return `encoded:${value}`;
      },
      async decode(value) {
        return value.replace(/^encoded:/, '');
      }
    };
    const store = createDurableExecutionLogStore(kv, { keyPrefix: 'test', codec });

    await store.append(logRecord('req-1'));

    expect([...kv.values.values()][0]).toMatch(/^encoded:/);
    expect(await store.readByRequest('req-1')).toHaveLength(1);
  });
});

function logRecord(requestId: string): ExecutionLogRecord {
  return {
    requestId,
    userId: 'user@example.com',
    actionType: 'personal_task',
    title: 'Buy coffee',
    status: 'created',
    message: 'Created',
    providerId: 'task-id',
    createdAt: '2026-07-12T12:00:00.000Z'
  };
}
