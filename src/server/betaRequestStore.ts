import { createPlainTextCodec, type KeyValueStore, type SecretCodec } from './durableStore';
import type { BetaRequestRecord } from '../api/publicContract';

export type BetaRequestStore = {
  append(record: BetaRequestRecord): Promise<void>;
  readRecent(limit?: number): Promise<BetaRequestRecord[]>;
  clear(): Promise<void>;
};

export type DurableBetaRequestStoreOptions = {
  keyPrefix?: string;
  codec?: SecretCodec;
};

export function createMemoryBetaRequestStore(): BetaRequestStore & { records: BetaRequestRecord[] } {
  const records: BetaRequestRecord[] = [];

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

export function createDurableBetaRequestStore(
  store: KeyValueStore,
  options: DurableBetaRequestStoreOptions = {}
): BetaRequestStore {
  const prefix = options.keyPrefix ?? 'brain-dump';
  const codec = options.codec ?? createPlainTextCodec();
  const storeKey = `${prefix}:beta-requests`;

  return {
    async append(record) {
      const records = await readRecords(store, codec, storeKey);
      const withoutDuplicateEmail = records.filter((existing) => existing.email.toLowerCase() !== record.email.toLowerCase());
      withoutDuplicateEmail.push(record);
      withoutDuplicateEmail.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      await store.set(storeKey, await codec.encode(JSON.stringify(withoutDuplicateEmail.slice(0, 500))));
    },
    async readRecent(limit = 50) {
      return (await readRecords(store, codec, storeKey)).slice(0, limit);
    },
    async clear() {
      await store.delete(storeKey);
    }
  };
}

async function readRecords(store: KeyValueStore, codec: SecretCodec, storeKey: string): Promise<BetaRequestRecord[]> {
  const raw = await store.get(storeKey);
  if (!raw) return [];

  try {
    const value = JSON.parse(await codec.decode(raw));
    return Array.isArray(value) ? value.filter(isBetaRequestRecord) : [];
  } catch {
    return [];
  }
}

function isBetaRequestRecord(value: unknown): value is BetaRequestRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.status === 'new' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    typeof value.tools === 'string' &&
    typeof value.googleComfort === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
