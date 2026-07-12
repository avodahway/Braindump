import { describe, expect, it } from 'vitest';
import { buildGoogleAuthorizationUrl, createPublicBackend } from './publicBackend';

const googleOAuth = {
  clientId: 'client-id',
  redirectUri: 'https://api.example.com/api/auth/google/callback',
  scopes: ['openid', 'email', 'https://www.googleapis.com/auth/tasks']
};

describe('public backend scaffold', () => {
  it('builds a Google OAuth authorization URL', () => {
    const url = new URL(buildGoogleAuthorizationUrl(googleOAuth));

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/tasks');
  });

  it('returns workspace and processes brain dumps through the public route', async () => {
    const backend = createPublicBackend({ googleOAuth });

    const workspaceResponse = await backend.handle(new Request('https://api.example.com/api/workspace'));
    const workspace = await workspaceResponse.json();
    expect(workspace.status).toBe('connected');

    const processResponse = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-1',
          text: 'Pay employees tomorrow. Lunch with Jack Thursday at noon; put on calendar.',
          timezone: 'America/Chicago'
        })
      })
    );
    const result = await processResponse.json();
    expect(result.summary.workTasks).toBe(1);
    expect(result.summary.calendar).toBe(1);
    expect(result.actions.every((action: { status: string }) => action.status === 'created')).toBe(true);
  });

  it('returns the same response for duplicate request ids', async () => {
    const backend = createPublicBackend({ googleOAuth });
    const request = {
      requestId: 'req-duplicate',
      text: 'Buy coffee',
      timezone: 'America/Chicago'
    };

    const first = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify(request)
      })
    );
    const second = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({ ...request, text: 'Different text' })
      })
    );

    expect(await first.json()).toEqual(await second.json());
  });

  it('blocks processing after disconnect', async () => {
    const backend = createPublicBackend({ googleOAuth });

    await backend.handle(new Request('https://api.example.com/api/auth/google/disconnect', { method: 'POST' }));
    const response = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({ requestId: 'req-2', text: 'Buy coffee', timezone: 'America/Chicago' })
      })
    );

    expect(response.status).toBe(409);
  });
});
