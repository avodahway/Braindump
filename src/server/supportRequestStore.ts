import { createPlainTextCodec, type KeyValueStore, type SecretCodec } from './durableStore';
import type { SupportRequestRecord, SupportRequestStatus } from '../api/publicContract';

export type SupportRequestStore = {
  append(record: SupportRequestRecord): Promise<void>;
  readRecent(limit?: number): Promise<SupportRequestRecord[]>;
  updateStatus(id: string, status: SupportRequestStatus, updatedAt: string): Promise<SupportRequestRecord | undefined>;
  clear(): Promise<void>;
};

export type DurableSupportRequestStoreOptions = {
  keyPrefix?: string;
  codec?: SecretCodec;
};

export function createMemorySupportRequestStore(): SupportRequestStore & { records: SupportRequestRecord[] } {
  const records: SupportRequestRecord[] = [];

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
    async updateStatus(id, status, updatedAt) {
      const record = records.find((current) => current.id === id);
      if (!record) return undefined;
      record.status = status;
      record.updatedAt = updatedAt;
      return record;
    },
    async clear() {
      records.length = 0;
    }
  };
}

export function createDurableSupportRequestStore(
  store: KeyValueStore,
  options: DurableSupportRequestStoreOptions = {}
): SupportRequestStore {
  const prefix = options.keyPrefix ?? 'brain-dump';
  const codec = options.codec ?? createPlainTextCodec();
  const storeKey = `${prefix}:support-requests`;

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
    async updateStatus(id, status, updatedAt) {
      const records = await readRecords(store, codec, storeKey);
      const index = records.findIndex((record) => record.id === id);
      if (index < 0) return undefined;
      records[index] = { ...records[index], status, updatedAt };
      await store.set(storeKey, await codec.encode(JSON.stringify(records)));
      return records[index];
    },
    async clear() {
      await store.delete(storeKey);
    }
  };
}

async function readRecords(store: KeyValueStore, codec: SecretCodec, storeKey: string): Promise<SupportRequestRecord[]> {
  const raw = await store.get(storeKey);
  if (!raw) return [];

  try {
    const value = JSON.parse(await codec.decode(raw));
    return Array.isArray(value) ? value.filter(isSupportRequestRecord) : [];
  } catch {
    return [];
  }
}

function isSupportRequestRecord(value: unknown): value is SupportRequestRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isSupportRequestStatus(value.status) &&
    typeof value.email === 'string' &&
    typeof value.issueType === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.details === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function isSupportRequestStatus(value: unknown): value is SupportRequestStatus {
  return value === 'new' || value === 'in_progress' || value === 'resolved' || value === 'archived';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
