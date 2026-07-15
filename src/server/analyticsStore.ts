import type { AnalyticsEvent, AnalyticsEventName } from '../lib/types';
import { createPlainTextCodec, type KeyValueStore, type SecretCodec } from './durableStore';

export type AnalyticsRecord = AnalyticsEvent & {
  name: AnalyticsEventName;
  userId?: string;
  createdAt: string;
};

export type AnalyticsStore = {
  append(record: AnalyticsRecord): Promise<void>;
  readAll(): Promise<AnalyticsRecord[]>;
  deleteByUser(userId: string): Promise<void>;
  clear(): Promise<void>;
};

export type AnalyticsMetrics = {
  totalEvents: number;
  uniqueUsers: number;
  uniqueRequests: number;
  totalActions: number;
  totalErrors: number;
  byName: Partial<Record<AnalyticsEventName, number>>;
  latestEventAt?: string;
};

export type DurableAnalyticsStoreOptions = {
  keyPrefix?: string;
  codec?: SecretCodec;
};

export function createMemoryAnalyticsStore(): AnalyticsStore & { records: AnalyticsRecord[] } {
  const records: AnalyticsRecord[] = [];
  return {
    records,
    async append(record) {
      records.push(record);
    },
    async readAll() {
      return [...records];
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

export function createDurableAnalyticsStore(
  store: KeyValueStore,
  options: DurableAnalyticsStoreOptions = {}
): AnalyticsStore {
  const prefix = options.keyPrefix ?? 'brain-dump';
  const codec = options.codec ?? createPlainTextCodec();
  const storeKey = `${prefix}:analytics-events`;

  return {
    async append(record) {
      const records = await readRecords(store, codec, storeKey);
      records.push(record);
      await store.set(storeKey, await codec.encode(JSON.stringify(records)));
    },
    async readAll() {
      return readRecords(store, codec, storeKey);
    },
    async deleteByUser(userId) {
      const normalizedUserId = normalizedId(userId);
      const records = await readRecords(store, codec, storeKey);
      const remainingRecords = records.filter((record) => record.userId?.toLowerCase() !== normalizedUserId);
      if (remainingRecords.length) {
        await store.set(storeKey, await codec.encode(JSON.stringify(remainingRecords)));
      } else {
        await store.delete(storeKey);
      }
    },
    async clear() {
      await store.delete(storeKey);
    }
  };
}

export function sanitizeAnalyticsEvent(value: unknown): AnalyticsEvent | undefined {
  if (!isRecord(value) || !isAnalyticsEventName(value.name)) return undefined;
  const event: AnalyticsEvent = { name: value.name };
  if (typeof value.requestId === 'string') event.requestId = value.requestId;
  if (typeof value.mode === 'string') event.mode = value.mode;
  if (typeof value.errorCount === 'number') event.errorCount = value.errorCount;
  if (typeof value.actionCount === 'number') event.actionCount = value.actionCount;
  if (isSummary(value.summary)) event.summary = value.summary;
  return event;
}

export function summarizeAnalytics(records: AnalyticsRecord[]): AnalyticsMetrics {
  const byName: Partial<Record<AnalyticsEventName, number>> = {};
  const users = new Set<string>();
  const requests = new Set<string>();
  let totalActions = 0;
  let totalErrors = 0;
  let latestEventAt: string | undefined;

  records.forEach((record) => {
    byName[record.name] = (byName[record.name] ?? 0) + 1;
    if (record.userId) users.add(record.userId);
    if (record.requestId) requests.add(record.requestId);
    totalActions += record.actionCount ?? 0;
    totalErrors += record.errorCount ?? 0;
    if (!latestEventAt || record.createdAt > latestEventAt) latestEventAt = record.createdAt;
  });

  return {
    totalEvents: records.length,
    uniqueUsers: users.size,
    uniqueRequests: requests.size,
    totalActions,
    totalErrors,
    byName,
    latestEventAt
  };
}

async function readRecords(store: KeyValueStore, codec: SecretCodec, storeKey: string): Promise<AnalyticsRecord[]> {
  const raw = await store.get(storeKey);
  if (!raw) return [];

  try {
    const value = JSON.parse(await codec.decode(raw));
    return Array.isArray(value) ? value.filter(isAnalyticsRecord) : [];
  } catch {
    return [];
  }
}

function isAnalyticsRecord(value: unknown): value is AnalyticsRecord {
  return isRecord(value) && isAnalyticsEventName(value.name) && typeof value.createdAt === 'string';
}

function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return (
    value === 'app_opened' ||
    value === 'connect_started' ||
    value === 'connect_completed' ||
    value === 'connect_failed' ||
    value === 'review_created' ||
    value === 'create_completed' ||
    value === 'create_failed' ||
    value === 'disconnect_completed'
  );
}

function isSummary(value: unknown): value is AnalyticsEvent['summary'] {
  return (
    isRecord(value) &&
    typeof value.calendar === 'number' &&
    typeof value.workTasks === 'number' &&
    typeof value.personalTasks === 'number' &&
    typeof value.projects === 'number' &&
    typeof value.waiting === 'number' &&
    typeof value.needsReview === 'number'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizedId(value: string): string {
  return value.toLowerCase();
}
