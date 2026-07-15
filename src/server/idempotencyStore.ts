import type { BrainDumpResponse } from '../lib/types';
import {
  createPlainTextCodec,
  type KeyValueStore,
  type SecretCodec
} from './durableStore';

export type ResponseStore = {
  readResponse(requestId: string): Promise<BrainDumpResponse | undefined>;
  saveResponse(requestId: string, response: BrainDumpResponse, userId?: string): Promise<void>;
  deleteByUser(userId: string): Promise<void>;
  clear(): Promise<void>;
};

export type DurableResponseStoreOptions = {
  keyPrefix?: string;
  codec?: SecretCodec;
};

export function createMemoryResponseStore(): ResponseStore & {
  responses: Map<string, BrainDumpResponse>;
  userRequests: Map<string, Set<string>>;
} {
  const responses = new Map<string, BrainDumpResponse>();
  const userRequests = new Map<string, Set<string>>();

  return {
    responses,
    userRequests,
    async readResponse(requestId) {
      return responses.get(requestId);
    },
    async saveResponse(requestId, response, userId) {
      responses.set(requestId, response);
      if (userId) addUserRequest(userRequests, userId, requestId);
    },
    async deleteByUser(userId) {
      const requestIds = userRequests.get(normalizedId(userId)) ?? new Set<string>();
      requestIds.forEach((requestId) => responses.delete(requestId));
      userRequests.delete(normalizedId(userId));
    },
    async clear() {
      responses.clear();
      userRequests.clear();
    }
  };
}

export function createDurableResponseStore(
  store: KeyValueStore,
  options: DurableResponseStoreOptions = {}
): ResponseStore {
  const prefix = options.keyPrefix ?? 'brain-dump';
  const codec = options.codec ?? createPlainTextCodec();

  return {
    async readResponse(requestId) {
      const raw = await store.get(key(prefix, requestId));
      if (!raw) return undefined;

      try {
        const value = JSON.parse(await codec.decode(raw));
        return isBrainDumpResponse(value) ? value : undefined;
      } catch {
        return undefined;
      }
    },
    async saveResponse(requestId, response, userId) {
      await store.set(key(prefix, requestId), await codec.encode(JSON.stringify(response)));
      if (userId) {
        const indexKey = userIndexKey(prefix, userId);
        const requestIds = await readStringArray(store, codec, indexKey);
        if (!requestIds.includes(normalizedId(requestId))) {
          requestIds.push(normalizedId(requestId));
          await store.set(indexKey, await codec.encode(JSON.stringify(requestIds)));
        }
      }
    },
    async deleteByUser(userId) {
      const indexKey = userIndexKey(prefix, userId);
      const requestIds = await readStringArray(store, codec, indexKey);
      await Promise.all(requestIds.map((requestId) => store.delete(key(prefix, requestId))));
      await store.delete(indexKey);
    },
    async clear() {
      return undefined;
    }
  };
}

function key(prefix: string, requestId: string): string {
  return `${prefix}:brain-dump-response:${normalizedId(requestId)}`;
}

function userIndexKey(prefix: string, userId: string): string {
  return `${prefix}:brain-dump-response-index:${normalizedId(userId)}`;
}

function normalizedId(value: string): string {
  return value.toLowerCase();
}

function addUserRequest(index: Map<string, Set<string>>, userId: string, requestId: string): void {
  const keyName = normalizedId(userId);
  const requestIds = index.get(keyName) ?? new Set<string>();
  requestIds.add(normalizedId(requestId));
  index.set(keyName, requestIds);
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

function isBrainDumpResponse(value: unknown): value is BrainDumpResponse {
  return (
    isRecord(value) &&
    typeof value.ok === 'boolean' &&
    typeof value.requestId === 'string' &&
    isRecord(value.summary) &&
    Array.isArray(value.actions) &&
    Array.isArray(value.errors)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
