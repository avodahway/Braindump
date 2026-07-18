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

  it('reads recent in-memory errors newest first', async () => {
    const store = createMemoryExecutionLogStore();

    await store.append({ ...logRecord('req-1'), status: 'error', message: 'Old failure', createdAt: '2026-07-12T12:00:00.000Z' });
    await store.append({ ...logRecord('req-2'), status: 'created', message: 'Created', createdAt: '2026-07-12T12:01:00.000Z' });
    await store.append({ ...logRecord('req-3'), status: 'error', message: 'New failure', createdAt: '2026-07-12T12:02:00.000Z' });

    expect(await store.readRecentErrors()).toMatchObject([
      { requestId: 'req-3', message: 'New failure' },
      { requestId: 'req-1', message: 'Old failure' }
    ]);
    expect(await store.readRecentErrors(1)).toMatchObject([{ requestId: 'req-3' }]);
  });

  it('keeps a durable recent error index', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createDurableExecutionLogStore(kv, { keyPrefix: 'test' });

    await store.append({ ...logRecord('req-1'), status: 'error', message: 'Old failure', createdAt: '2026-07-12T12:00:00.000Z' });
    await store.append({ ...logRecord('req-2'), status: 'error', message: 'New failure', createdAt: '2026-07-12T12:02:00.000Z' });

    expect(await store.readRecentErrors()).toMatchObject([
      { requestId: 'req-2', message: 'New failure' },
      { requestId: 'req-1', message: 'Old failure' }
    ]);
    expect(kv.values.has('test:execution-log-errors')).toBe(true);
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

  it('deletes only one user logs from memory', async () => {
    const store = createMemoryExecutionLogStore();

    await store.append(logRecord('req-1'));
    await store.append({ ...logRecord('req-2'), userId: 'other@example.com' });
    await store.deleteByUser('USER@example.com');

    expect(await store.readByRequest('req-1')).toEqual([]);
    expect(await store.readByRequest('req-2')).toHaveLength(1);
  });

  it('deletes durable logs from a user index', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createDurableExecutionLogStore(kv, { keyPrefix: 'test' });

    await store.append(logRecord('req-1'));
    await store.append({ ...logRecord('req-2'), userId: 'other@example.com' });
    await store.deleteByUser('user@example.com');

    expect(await store.readByRequest('req-1')).toEqual([]);
    expect(await store.readByRequest('req-2')).toHaveLength(1);
    expect(kv.values.has('test:execution-log-index:user@example.com')).toBe(false);
  });

  it('removes durable user errors from the recent error index', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createDurableExecutionLogStore(kv, { keyPrefix: 'test' });

    await store.append({ ...logRecord('req-1'), status: 'error', message: 'User failure' });
    await store.append({ ...logRecord('req-2'), userId: 'other@example.com', status: 'error', message: 'Other failure' });
    await store.deleteByUser('user@example.com');

    expect(await store.readRecentErrors()).toMatchObject([{ requestId: 'req-2', message: 'Other failure' }]);
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
