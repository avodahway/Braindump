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
  readByRequest(requestId: string): Promise<ExecutionLogRecord[]>;
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
    async readByRequest(requestId) {
      return records.filter((record) => record.requestId === requestId);
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
    },
    async readByRequest(requestId) {
      return readRecords(store, codec, key(prefix, requestId));
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
  return `${prefix}:execution-log:${requestId.toLowerCase()}`;
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
