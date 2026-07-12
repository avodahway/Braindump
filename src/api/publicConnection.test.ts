import { describe, expect, it, vi } from 'vitest';
import type { BackendSettings } from './client';
import { connectPublicWorkspace, disconnectPublicWorkspace, refreshPublicWorkspace } from './publicConnection';

const baseSettings: BackendSettings = {
  backendMode: 'public',
  publicApiBaseUrl: '',
  backendUrl: '',
  sharedSecret: ''
};

describe('public connection helpers', () => {
  it('uses local demo workspace when no Public API URL is configured', async () => {
    localStorage.clear();

    const workspace = await connectPublicWorkspace(baseSettings, { assign: vi.fn() });

    expect(workspace?.status).toBe('connected');
    expect(workspace?.email).toBe('demo@braindump.local');
  });

  it('starts real OAuth when Public API URL is configured', async () => {
    const assign = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc' }))
      )
    );

    const workspace = await connectPublicWorkspace(
      { ...baseSettings, publicApiBaseUrl: 'https://api.example.com' },
      { assign }
    );

    expect(workspace).toBeUndefined();
    expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=abc');
  });

  it('disconnects public backend and clears local workspace', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }))));

    const workspace = await disconnectPublicWorkspace({ ...baseSettings, publicApiBaseUrl: 'https://api.example.com' });

    expect(workspace.status).toBe('not_connected');
  });

  it('refreshes workspace only when Public API URL is configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'connected', email: 'person@example.com', destinations: [] }))
      )
    );

    await expect(refreshPublicWorkspace(baseSettings)).resolves.toBeUndefined();
    await expect(refreshPublicWorkspace({ ...baseSettings, publicApiBaseUrl: 'https://api.example.com' })).resolves.toEqual({
      status: 'connected',
      email: 'person@example.com',
      destinations: []
    });
  });
});
