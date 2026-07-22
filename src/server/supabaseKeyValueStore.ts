import type { KeyValueStore } from './durableStore';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type SupabaseKeyValueStoreOptions = {
  supabaseUrl: string;
  serviceRoleKey: string;
  tableName?: string;
  fetcher?: Fetcher;
};

export function createSupabaseKeyValueStore({
  supabaseUrl,
  serviceRoleKey,
  tableName = 'brain_dump_kv',
  fetcher = fetch
}: SupabaseKeyValueStoreOptions): KeyValueStore {
  const restUrl = `${normalizeSupabaseUrl(supabaseUrl)}/rest/v1/${encodeURIComponent(tableName)}`;

  return {
    async get(key) {
      const response = await fetcher(`${restUrl}?store_key=eq.${encodeFilterValue(key)}&select=value`, {
        headers: supabaseHeaders(serviceRoleKey)
      });
      await assertSupabaseOk(response, 'read key');
      const rows = (await response.json()) as Array<{ value?: string }>;
      return typeof rows[0]?.value === 'string' ? rows[0].value : undefined;
    },

    async set(key, value) {
      const response = await fetcher(`${restUrl}?on_conflict=store_key`, {
        method: 'POST',
        headers: {
          ...supabaseHeaders(serviceRoleKey),
          'content-type': 'application/json',
          prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ store_key: key, value })
      });
      await assertSupabaseOk(response, 'write key');
    },

    async delete(key) {
      const response = await fetcher(`${restUrl}?store_key=eq.${encodeFilterValue(key)}`, {
        method: 'DELETE',
        headers: supabaseHeaders(serviceRoleKey)
      });
      await assertSupabaseOk(response, 'delete key');
    }
  };
}

function normalizeSupabaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function encodeFilterValue(value: string): string {
  return encodeURIComponent(value);
}

function supabaseHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`
  };
}

async function assertSupabaseOk(response: Response, action: string): Promise<void> {
  if (response.ok) return;

  const body = await response.text().catch(() => '');
  throw new Error(`Supabase could not ${action}: ${response.status}${body ? ` ${body}` : ''}`);
}
