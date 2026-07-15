import { describe, expect, it, vi } from 'vitest';
import { createSupabaseKeyValueStore } from './supabaseKeyValueStore';

describe('supabase key-value store', () => {
  it('reads values from the configured table', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([{ value: 'stored-value' }])));
    const store = createSupabaseKeyValueStore({
      supabaseUrl: 'https://project.supabase.co/',
      serviceRoleKey: 'service-key',
      fetcher
    });

    await expect(store.get('brain-dump:session:abc')).resolves.toBe('stored-value');

    expect(fetcher).toHaveBeenCalledWith(
      'https://project.supabase.co/rest/v1/brain_dump_kv?store_key=eq.brain-dump%3Asession%3Aabc&select=value',
      expect.objectContaining({
        headers: {
          apikey: 'service-key',
          authorization: 'Bearer service-key'
        }
      })
    );
  });

  it('returns undefined when a key is missing', async () => {
    const store = createSupabaseKeyValueStore({
      supabaseUrl: 'https://project.supabase.co',
      serviceRoleKey: 'service-key',
      fetcher: vi.fn(async () => new Response(JSON.stringify([])))
    });

    await expect(store.get('missing')).resolves.toBeUndefined();
  });

  it('upserts values by store key', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 201 }));
    const store = createSupabaseKeyValueStore({
      supabaseUrl: 'https://project.supabase.co',
      serviceRoleKey: 'service-key',
      tableName: 'custom_kv',
      fetcher
    });

    await store.set('key-1', 'value-1');

    expect(fetcher).toHaveBeenCalledWith(
      'https://project.supabase.co/rest/v1/custom_kv?on_conflict=store_key',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'service-key',
          authorization: 'Bearer service-key',
          'content-type': 'application/json',
          prefer: 'resolution=merge-duplicates'
        }),
        body: JSON.stringify({ store_key: 'key-1', value: 'value-1' })
      })
    );
  });

  it('deletes values by store key', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    const store = createSupabaseKeyValueStore({
      supabaseUrl: 'https://project.supabase.co',
      serviceRoleKey: 'service-key',
      fetcher
    });

    await store.delete('key-1');

    expect(fetcher).toHaveBeenCalledWith(
      'https://project.supabase.co/rest/v1/brain_dump_kv?store_key=eq.key-1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('raises useful Supabase errors', async () => {
    const store = createSupabaseKeyValueStore({
      supabaseUrl: 'https://project.supabase.co',
      serviceRoleKey: 'service-key',
      fetcher: vi.fn(async () => new Response('nope', { status: 500 }))
    });

    await expect(store.get('key')).rejects.toThrow('Supabase could not read key: 500 nope');
  });
});
