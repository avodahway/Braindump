import { describe, expect, it, vi } from 'vitest';
import {
  normalizeApiBaseUrl,
  processPublicBrainDump,
  publicApiUrl,
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
});
