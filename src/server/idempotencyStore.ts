import type { BrainDumpResponse } from '../lib/types';
import {
  createPlainTextCodec,
  type KeyValueStore,
  type SecretCodec
} from './durableStore';

export type ResponseStore = {
  readResponse(requestId: string): Promise<BrainDumpResponse | undefined>;
  saveResponse(requestId: string, response: BrainDumpResponse): Promise<void>;
  clear(): Promise<void>;
};

export type DurableResponseStoreOptions = {
  keyPrefix?: string;
  codec?: SecretCodec;
};

export function createMemoryResponseStore(): ResponseStore & {
  responses: Map<string, BrainDumpResponse>;
} {
  const responses = new Map<string, BrainDumpResponse>();

  return {
    responses,
    async readResponse(requestId) {
      return responses.get(requestId);
    },
    async saveResponse(requestId, response) {
      responses.set(requestId, response);
    },
    async clear() {
      responses.clear();
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
    async saveResponse(requestId, response) {
      await store.set(key(prefix, requestId), await codec.encode(JSON.stringify(response)));
    },
    async clear() {
      return undefined;
    }
  };
}

function key(prefix: string, requestId: string): string {
  return `${prefix}:brain-dump-response:${requestId.toLowerCase()}`;
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
