import type { ActionType } from '../lib/types';
import {
  createPlainTextCodec,
  type KeyValueStore,
  type SecretCodec
} from './durableStore';

export type ExecutionLogRecord = {
  requestId: string;
  userId?: string;
  actionType: ActionType;
  title: string;
  status: 'created' | 'needs_review' | 'error';
  message: string;
  providerId?: string;
  createdAt: string;
};

export type ExecutionLogStore = {
  append(record: ExecutionLogRecord): Promise<void>;
  readRecent(limit?: number): Promise<ExecutionLogRecord[]>;
  readByRequest(requestId: string): Promise<ExecutionLogRecord[]>;
  readRecentErrors(limit?: number): Promise<ExecutionLogRecord[]>;
  deleteByUser(userId: string): Promise<void>;
  clear(): Promise<void>;
};

export type DurableExecutionLogStoreOptions = {
  keyPrefix?: string;
  codec?: SecretCodec;
};

export function createMemoryExecutionLogStore(): ExecutionLogStore & {
  records: ExecutionLogRecord[];
} {
  const records: ExecutionLogRecord[] = [];

  return {
    records,
    async append(record) {
      records.push(record);
    },
    async readRecent(limit = 100) {
      return [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, limit);
    },
    async readByRequest(requestId) {
      return records.filter((record) => record.requestId === requestId);
    },
    async readRecentErrors(limit = 20) {
      return records
        .filter((record) => record.status === 'error')
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit);
    },
    async deleteByUser(userId) {
      const normalizedUserId = normalizedId(userId);
      for (let index = records.length - 1; index >= 0; index -= 1) {
        if (records[index].userId?.toLowerCase() === normalizedUserId) records.splice(index, 1);
      }
    },
    async clear() {
      records.length = 0;
    }
  };
}

export function createDurableExecutionLogStore(
  store: KeyValueStore,
  options: DurableExecutionLogStoreOptions = {}
): ExecutionLogStore {
  const prefix = options.keyPrefix ?? 'brain-dump';
  const codec = options.codec ?? createPlainTextCodec();

  return {
    async append(record) {
      const logKey = key(prefix, record.requestId);
      const records = await readRecords(store, codec, logKey);
      records.push(record);
      await store.set(logKey, await codec.encode(JSON.stringify(records)));
      const recent = await readRecords(store, codec, recentIndexKey(prefix));
      recent.push(record);
      recent.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      await store.set(recentIndexKey(prefix), await codec.encode(JSON.stringify(recent.slice(0, 500))));
      if (record.status === 'error') {
        const errors = await readRecords(store, codec, errorIndexKey(prefix));
        errors.push(record);
        errors.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        await store.set(errorIndexKey(prefix), await codec.encode(JSON.stringify(errors.slice(0, 100))));
      }
      if (record.userId) {
        const indexKey = userIndexKey(prefix, record.userId);
        const requestIds = await readStringArray(store, codec, indexKey);
        if (!requestIds.includes(normalizedId(record.requestId))) {
          requestIds.push(normalizedId(record.requestId));
          await store.set(indexKey, await codec.encode(JSON.stringify(requestIds)));
        }
      }
    },
    async readByRequest(requestId) {
      return readRecords(store, codec, key(prefix, requestId));
    },
    async readRecent(limit = 100) {
      const records = await readRecords(store, codec, recentIndexKey(prefix));
      return records.slice(0, limit);
    },
    async readRecentErrors(limit = 20) {
      const records = await readRecords(store, codec, errorIndexKey(prefix));
      return records.slice(0, limit);
    },
    async deleteByUser(userId) {
      const indexKey = userIndexKey(prefix, userId);
      const requestIds = await readStringArray(store, codec, indexKey);
      await Promise.all(requestIds.map((requestId) => store.delete(key(prefix, requestId))));
      const errors = await readRecords(store, codec, errorIndexKey(prefix));
      const normalizedUserId = normalizedId(userId);
      const remainingErrors = errors.filter((record) => record.userId?.toLowerCase() !== normalizedUserId);
      if (remainingErrors.length) {
        await store.set(errorIndexKey(prefix), await codec.encode(JSON.stringify(remainingErrors)));
      } else {
        await store.delete(errorIndexKey(prefix));
      }
      const recent = await readRecords(store, codec, recentIndexKey(prefix));
      const remainingRecent = recent.filter((record) => record.userId?.toLowerCase() !== normalizedUserId);
      if (remainingRecent.length) {
        await store.set(recentIndexKey(prefix), await codec.encode(JSON.stringify(remainingRecent)));
      } else {
        await store.delete(recentIndexKey(prefix));
      }
      await store.delete(indexKey);
    },
    async clear() {
      return undefined;
    }
  };
}

async function readRecords(
  store: KeyValueStore,
  codec: SecretCodec,
  logKey: string
): Promise<ExecutionLogRecord[]> {
  const raw = await store.get(logKey);
  if (!raw) return [];

  try {
    const value = JSON.parse(await codec.decode(raw));
    return Array.isArray(value) ? value.filter(isExecutionLogRecord) : [];
  } catch {
    return [];
  }
}

function key(prefix: string, requestId: string): string {
  return `${prefix}:execution-log:${normalizedId(requestId)}`;
}

function userIndexKey(prefix: string, userId: string): string {
  return `${prefix}:execution-log-index:${normalizedId(userId)}`;
}

function errorIndexKey(prefix: string): string {
  return `${prefix}:execution-log-errors`;
}

function recentIndexKey(prefix: string): string {
  return `${prefix}:execution-log-recent`;
}

function normalizedId(value: string): string {
  return value.toLowerCase();
}

async function readStringArray(store: KeyValueStore, codec: SecretCodec, keyName: string): Promise<string[]> {
  const raw = await store.get(keyName);
  if (!raw) return [];

  try {
    const value = JSON.parse(await codec.decode(raw));
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function isExecutionLogRecord(value: unknown): value is ExecutionLogRecord {
  return (
    isRecord(value) &&
    typeof value.requestId === 'string' &&
    typeof value.actionType === 'string' &&
    typeof value.title === 'string' &&
    typeof value.status === 'string' &&
    typeof value.message === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
