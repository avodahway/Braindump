import { createPlainTextCodec, type KeyValueStore, type SecretCodec } from './durableStore';
import type { FeedbackRecord } from '../api/publicContract';

export type FeedbackStore = {
  append(record: FeedbackRecord): Promise<void>;
  readRecent(limit?: number): Promise<FeedbackRecord[]>;
  clear(): Promise<void>;
};

export type DurableFeedbackStoreOptions = {
  keyPrefix?: string;
  codec?: SecretCodec;
};

export function createMemoryFeedbackStore(): FeedbackStore & { records: FeedbackRecord[] } {
  const records: FeedbackRecord[] = [];

  return {
    records,
    async append(record) {
      records.push(record);
    },
    async readRecent(limit = 50) {
      return [...records]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit);
    },
    async clear() {
      records.length = 0;
    }
  };
}

export function createDurableFeedbackStore(
  store: KeyValueStore,
  options: DurableFeedbackStoreOptions = {}
): FeedbackStore {
  const prefix = options.keyPrefix ?? 'brain-dump';
  const codec = options.codec ?? createPlainTextCodec();
  const storeKey = `${prefix}:feedback`;

  return {
    async append(record) {
      const records = await readRecords(store, codec, storeKey);
      records.push(record);
      records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      await store.set(storeKey, await codec.encode(JSON.stringify(records.slice(0, 500))));
    },
    async readRecent(limit = 50) {
      return (await readRecords(store, codec, storeKey)).slice(0, limit);
    },
    async clear() {
      await store.delete(storeKey);
    }
  };
}

async function readRecords(store: KeyValueStore, codec: SecretCodec, storeKey: string): Promise<FeedbackRecord[]> {
  const raw = await store.get(storeKey);
  if (!raw) return [];

  try {
    const value = JSON.parse(await codec.decode(raw));
    return Array.isArray(value) ? value.filter(isFeedbackRecord) : [];
  } catch {
    return [];
  }
}

function isFeedbackRecord(value: unknown): value is FeedbackRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.status === 'new' &&
    typeof value.lookedRight === 'string' &&
    typeof value.confusing === 'string' &&
    typeof value.expected === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
