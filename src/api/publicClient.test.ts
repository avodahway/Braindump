import { describe, expect, it, vi } from 'vitest';
import {
  deletePublicAccountData,
  getPublicBetaAccessStatus,
  normalizeApiBaseUrl,
  processPublicBrainDump,
  publicApiUrl,
  redeemPublicBetaAccessCode,
  startPublicGoogleConnection,
  trackPublicEvent
} from './publicClient';

describe('public API client', () => {
  it('normalizes API base URLs', () => {
    expect(normalizeApiBaseUrl(' https://api.example.com/// ')).toBe('https://api.example.com');
    expect(publicApiUrl('https://api.example.com/', '/api/workspace')).toBe('https://api.example.com/api/workspace');
  });

  it('starts Google connection through the public backend', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth' })));

    const result = await startPublicGoogleConnection('https://api.example.com', fetcher);

    expect(result.authorizationUrl).toContain('accounts.google.com');
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/auth/google/start', {
      method: 'POST',
      credentials: 'include'
    });
  });

  it('reads and redeems public beta access through the public backend', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ required: true, granted: false })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, access: { required: true, granted: true } })));

    await expect(getPublicBetaAccessStatus('https://api.example.com', fetcher)).resolves.toEqual({
      required: true,
      granted: false
    });
    await expect(redeemPublicBetaAccessCode('https://api.example.com', 'founder-beta', fetcher)).resolves.toEqual({
      ok: true,
      access: { required: true, granted: true }
    });

    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://api.example.com/api/beta/status', {
      credentials: 'include'
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.example.com/api/beta/access', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'founder-beta' })
    });
  });

  it('posts brain dumps to the public backend contract', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          requestId: 'req-1',
          summary: { calendar: 0, workTasks: 0, personalTasks: 1, projects: 0, waiting: 0, needsReview: 0 },
          actions: [],
          errors: []
        })
      )
    );

    await processPublicBrainDump(
      'https://api.example.com',
      { requestId: 'req-1', text: 'Buy coffee', timezone: 'America/Chicago' },
      fetcher
    );

    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/brain-dump', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: 'req-1', text: 'Buy coffee', timezone: 'America/Chicago' })
    });
  });

  it('uses backend error messages when public requests fail', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Google workspace is not connected.' }), {
        status: 409
      })
    );

    await expect(
      processPublicBrainDump(
        'https://api.example.com',
        { requestId: 'req-1', text: 'Buy coffee', timezone: 'America/Chicago' },
        fetcher
      )
    ).rejects.toThrow('Google workspace is not connected.');
  });

  it('posts analytics events without requiring brain dump text', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    await trackPublicEvent('https://api.example.com', { name: 'review_created', requestId: 'req-1', actionCount: 2 }, fetcher);

    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/events', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'review_created', requestId: 'req-1', actionCount: 2 })
    });
  });

  it('deletes public account data through the public backend', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, deleted: ['google_tokens', 'workspace'] }))
    );

    await deletePublicAccountData('https://api.example.com', fetcher);

    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/account/delete', {
      method: 'POST',
      credentials: 'include'
    });
  });
});
