import { describe, expect, it } from 'vitest';
import type { BrainDumpResponse, ParsedAction } from '../lib/types';
import { createMemoryOAuthStore, type TokenExchangeClient } from './oauthSession';
import { buildGoogleAuthorizationUrl, createPublicBackend } from './publicBackend';
import { createMemorySessionStore, sessionCookieName } from './sessionStore';
import { createMemoryResponseStore } from './idempotencyStore';
import { createMemoryExecutionLogStore } from './executionLogStore';
import { createMemoryAnalyticsStore } from './analyticsStore';
import { createMemoryBetaRequestStore } from './betaRequestStore';
import { createMemoryFeedbackStore } from './feedbackStore';
import { createMemorySupportRequestStore } from './supportRequestStore';

const googleOAuth = {
  clientId: 'client-id',
  redirectUri: 'https://api.example.com/api/auth/google/callback',
  scopes: ['openid', 'email', 'https://www.googleapis.com/auth/tasks']
};

describe('public backend scaffold', () => {
  it('returns anonymous health status', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      now: () => new Date('2026-07-12T12:00:00.000Z')
    });

    const response = await backend.handle(new Request('https://api.example.com/api/health'));

    expect(await response.json()).toEqual({
      ok: true,
      service: 'brain-dump-public-backend',
      time: '2026-07-12T12:00:00.000Z'
    });
  });

  it('answers credentialed CORS preflight from the configured frontend origin', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      frontendAppUrl: 'https://app.example.com/app'
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://app.example.com',
          'Access-Control-Request-Headers': 'content-type'
        }
      })
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('content-type');
  });

  it('adds credentialed CORS headers for allowed frontend requests', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      frontendAppUrl: 'https://app.example.com/app'
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/workspace', {
        headers: { Origin: 'https://app.example.com' }
      })
    );

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('blocks credentialed state-changing requests from other origins', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      frontendAppUrl: 'https://app.example.com/app'
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/auth/google/start', {
        method: 'POST',
        headers: { Origin: 'https://evil.example.com' }
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Request origin is not allowed.' });
  });

  it('builds a Google OAuth authorization URL', () => {
    const url = new URL(buildGoogleAuthorizationUrl(googleOAuth));

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/tasks');
  });

  it('reports beta access as open when no access code is configured', async () => {
    const backend = createPublicBackend({ googleOAuth });

    const response = await backend.handle(new Request('https://api.example.com/api/beta/status'));

    expect(await response.json()).toEqual({ required: false, granted: true });
  });

  it('requires and grants beta access with the configured access code', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      betaAccessCode: 'founder-beta'
    });

    const before = await backend.handle(new Request('https://api.example.com/api/beta/status'));
    const invalid = await backend.handle(
      new Request('https://api.example.com/api/beta/access', {
        method: 'POST',
        body: JSON.stringify({ code: 'wrong-code' })
      })
    );
    const valid = await backend.handle(
      new Request('https://api.example.com/api/beta/access', {
        method: 'POST',
        body: JSON.stringify({ code: 'founder-beta' })
      })
    );
    const betaCookie = valid.headers.get('Set-Cookie') ?? '';
    const after = await backend.handle(
      new Request('https://api.example.com/api/beta/status', {
        headers: { Cookie: betaCookie }
      })
    );

    expect(await before.json()).toEqual({ required: true, granted: false });
    expect(invalid.status).toBe(403);
    expect(await invalid.json()).toEqual({ error: 'Beta access code is invalid.' });
    expect(valid.status).toBe(200);
    expect(betaCookie).toContain('bd_beta_access=');
    expect(await after.json()).toEqual({ required: true, granted: true });
  });

  it('blocks Google connect until beta access is granted', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      betaAccessCode: 'founder-beta'
    });

    const blocked = await backend.handle(new Request('https://api.example.com/api/auth/google/start', { method: 'POST' }));
    const access = await backend.handle(
      new Request('https://api.example.com/api/beta/access', {
        method: 'POST',
        body: JSON.stringify({ code: 'founder-beta' })
      })
    );
    const allowed = await backend.handle(
      new Request('https://api.example.com/api/auth/google/start', {
        method: 'POST',
        headers: { Cookie: access.headers.get('Set-Cookie') ?? '' }
      })
    );

    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ error: 'Beta access code is required.' });
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).authorizationUrl).toContain('accounts.google.com');
  });

  it('accepts beta requests and protects the admin beta request list', async () => {
    const betaRequestStore = createMemoryBetaRequestStore();
    const backend = createPublicBackend({
      googleOAuth,
      betaRequestStore,
      adminToken: 'admin-token',
      now: () => new Date('2026-07-17T12:00:00.000Z')
    });

    const created = await backend.handle(
      new Request('https://api.example.com/api/beta/request', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Jay Cleveland',
          email: 'JAY@EXAMPLE.COM',
          tools: 'Google Tasks and Calendar',
          googleComfort: 'comfortable',
          notes: 'I want to test it.'
        })
      })
    );
    const blocked = await backend.handle(new Request('https://api.example.com/api/admin/beta-requests'));
    const listed = await backend.handle(
      new Request('https://api.example.com/api/admin/beta-requests', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );

    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({
      ok: true,
      request: {
        name: 'Jay Cleveland',
        email: 'jay@example.com',
        tools: 'Google Tasks and Calendar',
        googleComfort: 'comfortable',
        notes: 'I want to test it.',
        status: 'new',
        createdAt: '2026-07-17T12:00:00.000Z'
      }
    });
    expect(blocked.status).toBe(401);
    expect(await listed.json()).toMatchObject({
      requests: [
        {
          name: 'Jay Cleveland',
          email: 'jay@example.com'
        }
      ]
    });
  });

  it('exports beta requests as protected CSV', async () => {
    const betaRequestStore = createMemoryBetaRequestStore();
    const backend = createPublicBackend({
      googleOAuth,
      betaRequestStore,
      adminToken: 'admin-token',
      now: () => new Date('2026-07-17T12:00:00.000Z')
    });

    await betaRequestStore.append({
      id: 'beta-1',
      status: 'new',
      name: 'Jay Cleveland',
      email: 'jay@example.com',
      tools: 'Google Tasks, Calendar',
      googleComfort: 'comfortable',
      notes: '=IMPORTXML("https://example.com","//title")',
      createdAt: '2026-07-17T12:00:00.000Z'
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/admin/beta-requests?format=csv', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );

    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(await response.text()).toBe(
      'createdAt,name,email,tools,googleComfort,notes,status,id\n' +
        '2026-07-17T12:00:00.000Z,Jay Cleveland,jay@example.com,"Google Tasks, Calendar",comfortable,"\'=IMPORTXML(""https://example.com"",""//title"")",new,beta-1'
    );
  });

  it('filters protected beta request lists by status', async () => {
    const betaRequestStore = createMemoryBetaRequestStore();
    const backend = createPublicBackend({
      googleOAuth,
      betaRequestStore,
      adminToken: 'admin-token',
      now: () => new Date('2026-07-17T12:00:00.000Z')
    });

    await betaRequestStore.append({
      id: 'beta-new',
      status: 'new',
      name: 'New Tester',
      email: 'new@example.com',
      tools: 'Google Tasks',
      googleComfort: 'comfortable',
      createdAt: '2026-07-17T12:00:00.000Z'
    });
    await betaRequestStore.append({
      id: 'beta-invited',
      status: 'invited',
      name: 'Invited Tester',
      email: 'invited@example.com',
      tools: 'Google Calendar',
      googleComfort: 'comfortable',
      createdAt: '2026-07-17T12:01:00.000Z'
    });

    const listed = await backend.handle(
      new Request('https://api.example.com/api/admin/beta-requests?status=new', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );
    const csvResponse = await backend.handle(
      new Request('https://api.example.com/api/admin/beta-requests?status=new&format=csv', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );
    const invalid = await backend.handle(
      new Request('https://api.example.com/api/admin/beta-requests?status=maybe', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );

    expect(await listed.json()).toMatchObject({
      requests: [{ id: 'beta-new', email: 'new@example.com' }]
    });
    expect(await csvResponse.text()).toContain('new@example.com');
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'Invalid beta request status filter.' });
  });

  it('updates protected beta request status', async () => {
    const betaRequestStore = createMemoryBetaRequestStore();
    const backend = createPublicBackend({
      googleOAuth,
      betaRequestStore,
      adminToken: 'admin-token',
      now: () => new Date('2026-07-17T12:30:00.000Z')
    });

    await betaRequestStore.append({
      id: 'beta-1',
      status: 'new',
      name: 'Jay Cleveland',
      email: 'jay@example.com',
      tools: 'Google Tasks',
      googleComfort: 'comfortable',
      createdAt: '2026-07-17T12:00:00.000Z'
    });

    const blocked = await backend.handle(
      new Request('https://api.example.com/api/admin/beta-request', {
        method: 'POST',
        body: JSON.stringify({ id: 'beta-1', status: 'invited' })
      })
    );
    const updated = await backend.handle(
      new Request('https://api.example.com/api/admin/beta-request', {
        method: 'POST',
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' },
        body: JSON.stringify({ id: 'beta-1', status: 'invited' })
      })
    );

    expect(blocked.status).toBe(401);
    expect(await updated.json()).toMatchObject({
      ok: true,
      request: {
        id: 'beta-1',
        status: 'invited',
        updatedAt: '2026-07-17T12:30:00.000Z'
      }
    });
  });

  it('validates beta request fields', async () => {
    const backend = createPublicBackend({ googleOAuth });

    const response = await backend.handle(
      new Request('https://api.example.com/api/beta/request', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Jay Cleveland',
          email: 'not-an-email',
          tools: 'Google Tasks',
          googleComfort: 'comfortable'
        })
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'A valid email is required.' });
  });

  it('accepts feedback and protects the admin feedback list', async () => {
    const feedbackStore = createMemoryFeedbackStore();
    const backend = createPublicBackend({
      googleOAuth,
      feedbackStore,
      adminToken: 'admin-token',
      now: () => new Date('2026-07-17T12:00:00.000Z')
    });

    const created = await backend.handle(
      new Request('https://api.example.com/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          email: 'USER@EXAMPLE.COM',
          requestId: 'req-1',
          lookedRight: 'The task preview was clear.',
          confusing: 'The calendar wording was confusing.',
          expected: 'I expected a safer default.'
        })
      })
    );
    const blocked = await backend.handle(new Request('https://api.example.com/api/admin/feedback'));
    const listed = await backend.handle(
      new Request('https://api.example.com/api/admin/feedback', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );

    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({
      ok: true,
      feedback: {
        email: 'user@example.com',
        requestId: 'req-1',
        lookedRight: 'The task preview was clear.',
        confusing: 'The calendar wording was confusing.',
        expected: 'I expected a safer default.',
        status: 'new',
        createdAt: '2026-07-17T12:00:00.000Z'
      }
    });
    expect(blocked.status).toBe(401);
    expect(await listed.json()).toMatchObject({
      feedback: [
        {
          email: 'user@example.com',
          requestId: 'req-1'
        }
      ]
    });
  });

  it('exports feedback as protected CSV', async () => {
    const feedbackStore = createMemoryFeedbackStore();
    const backend = createPublicBackend({
      googleOAuth,
      feedbackStore,
      adminToken: 'admin-token'
    });

    await feedbackStore.append({
      id: 'feedback-1',
      status: 'new',
      email: 'user@example.com',
      requestId: 'req-1',
      lookedRight: 'Tasks were right.',
      confusing: 'Calendar felt unclear.',
      expected: 'More review guidance.',
      createdAt: '2026-07-17T12:00:00.000Z'
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/admin/feedback?format=csv', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );

    expect(response.headers.get('Content-Disposition')).toContain('brain-dump-feedback.csv');
    expect(await response.text()).toBe(
      'createdAt,email,requestId,lookedRight,confusing,expected,status,id\n' +
        '2026-07-17T12:00:00.000Z,user@example.com,req-1,Tasks were right.,Calendar felt unclear.,More review guidance.,new,feedback-1'
    );
  });

  it('filters protected feedback by status', async () => {
    const feedbackStore = createMemoryFeedbackStore();
    const backend = createPublicBackend({
      googleOAuth,
      feedbackStore,
      adminToken: 'admin-token'
    });

    await feedbackStore.append({
      id: 'feedback-new',
      status: 'new',
      email: 'new@example.com',
      lookedRight: 'Tasks',
      confusing: 'Calendar',
      expected: 'Review',
      createdAt: '2026-07-17T12:00:00.000Z'
    });
    await feedbackStore.append({
      id: 'feedback-reviewed',
      status: 'reviewed',
      email: 'reviewed@example.com',
      lookedRight: 'Projects',
      confusing: 'None',
      expected: 'Good',
      createdAt: '2026-07-17T12:01:00.000Z'
    });

    const listed = await backend.handle(
      new Request('https://api.example.com/api/admin/feedback?status=reviewed', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );
    const csvResponse = await backend.handle(
      new Request('https://api.example.com/api/admin/feedback?status=reviewed&format=csv', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );
    const invalid = await backend.handle(
      new Request('https://api.example.com/api/admin/feedback?status=maybe', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );

    expect(await listed.json()).toMatchObject({
      feedback: [{ id: 'feedback-reviewed', email: 'reviewed@example.com' }]
    });
    expect(await csvResponse.text()).toContain('reviewed@example.com');
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'Invalid feedback status filter.' });
  });

  it('updates protected feedback status', async () => {
    const feedbackStore = createMemoryFeedbackStore();
    const backend = createPublicBackend({
      googleOAuth,
      feedbackStore,
      adminToken: 'admin-token',
      now: () => new Date('2026-07-17T12:30:00.000Z')
    });

    await feedbackStore.append({
      id: 'feedback-1',
      status: 'new',
      email: 'user@example.com',
      lookedRight: 'Tasks were right.',
      confusing: 'Calendar felt unclear.',
      expected: 'More review guidance.',
      createdAt: '2026-07-17T12:00:00.000Z'
    });

    const updated = await backend.handle(
      new Request('https://api.example.com/api/admin/feedback-item', {
        method: 'POST',
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' },
        body: JSON.stringify({ id: 'feedback-1', status: 'reviewed' })
      })
    );

    expect(await updated.json()).toMatchObject({
      ok: true,
      feedback: {
        id: 'feedback-1',
        status: 'reviewed',
        updatedAt: '2026-07-17T12:30:00.000Z'
      }
    });
  });

  it('validates feedback fields', async () => {
    const backend = createPublicBackend({ googleOAuth });

    const response = await backend.handle(
      new Request('https://api.example.com/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          lookedRight: '',
          confusing: 'The calendar wording was confusing.',
          expected: 'I expected a safer default.'
        })
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'What looked right is required.' });
  });

  it('accepts support requests and protects the admin support queue', async () => {
    const supportRequestStore = createMemorySupportRequestStore();
    const backend = createPublicBackend({
      googleOAuth,
      supportRequestStore,
      adminToken: 'admin-token',
      now: () => new Date('2026-07-17T12:00:00.000Z')
    });

    const created = await backend.handle(
      new Request('https://api.example.com/api/support/request', {
        method: 'POST',
        body: JSON.stringify({
          email: 'USER@EXAMPLE.COM',
          issueType: 'google_connection',
          summary: 'Connection failed',
          details: 'OAuth callback showed an error.'
        })
      })
    );
    const listed = await backend.handle(
      new Request('https://api.example.com/api/admin/support-requests', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );

    expect(await created.json()).toMatchObject({
      ok: true,
      supportRequest: {
        email: 'user@example.com',
        issueType: 'google_connection',
        summary: 'Connection failed',
        status: 'new',
        createdAt: '2026-07-17T12:00:00.000Z'
      }
    });
    expect(await listed.json()).toMatchObject({
      supportRequests: [{ email: 'user@example.com', summary: 'Connection failed' }]
    });
  });

  it('updates protected support request status', async () => {
    const supportRequestStore = createMemorySupportRequestStore();
    const backend = createPublicBackend({
      googleOAuth,
      supportRequestStore,
      adminToken: 'admin-token',
      now: () => new Date('2026-07-17T12:30:00.000Z')
    });
    await supportRequestStore.append({
      id: 'support-1',
      status: 'new',
      email: 'user@example.com',
      issueType: 'google_connection',
      summary: 'Connection failed',
      details: 'OAuth callback showed an error.',
      createdAt: '2026-07-17T12:00:00.000Z'
    });

    const updated = await backend.handle(
      new Request('https://api.example.com/api/admin/support-request', {
        method: 'POST',
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' },
        body: JSON.stringify({ id: 'support-1', status: 'resolved' })
      })
    );

    expect(await updated.json()).toMatchObject({
      ok: true,
      supportRequest: {
        id: 'support-1',
        status: 'resolved',
        updatedAt: '2026-07-17T12:30:00.000Z'
      }
    });
  });

  it('exports support requests as protected CSV', async () => {
    const supportRequestStore = createMemorySupportRequestStore();
    const backend = createPublicBackend({
      googleOAuth,
      supportRequestStore,
      adminToken: 'admin-token'
    });
    await supportRequestStore.append({
      id: 'support-1',
      status: 'new',
      email: 'user@example.com',
      issueType: 'google_connection',
      summary: 'Connection failed',
      details: 'OAuth callback showed an error.',
      createdAt: '2026-07-17T12:00:00.000Z'
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/admin/support-requests?format=csv', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );

    expect(response.headers.get('Content-Disposition')).toContain('brain-dump-support-requests.csv');
    expect(await response.text()).toBe(
      'createdAt,email,issueType,summary,details,status,id\n' +
        '2026-07-17T12:00:00.000Z,user@example.com,google_connection,Connection failed,OAuth callback showed an error.,new,support-1'
    );
  });

  it('filters protected support requests by status', async () => {
    const supportRequestStore = createMemorySupportRequestStore();
    const backend = createPublicBackend({
      googleOAuth,
      supportRequestStore,
      adminToken: 'admin-token'
    });
    await supportRequestStore.append({
      id: 'support-new',
      status: 'new',
      email: 'new@example.com',
      issueType: 'google_connection',
      summary: 'Connection failed',
      details: 'OAuth callback showed an error.',
      createdAt: '2026-07-17T12:00:00.000Z'
    });
    await supportRequestStore.append({
      id: 'support-progress',
      status: 'in_progress',
      email: 'progress@example.com',
      issueType: 'data_deletion',
      summary: 'Deletion question',
      details: 'Needs help.',
      createdAt: '2026-07-17T12:01:00.000Z'
    });

    const listed = await backend.handle(
      new Request('https://api.example.com/api/admin/support-requests?status=in_progress', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );
    const csvResponse = await backend.handle(
      new Request('https://api.example.com/api/admin/support-requests?status=in_progress&format=csv', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );
    const invalid = await backend.handle(
      new Request('https://api.example.com/api/admin/support-requests?status=maybe', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
      })
    );

    expect(await listed.json()).toMatchObject({
      supportRequests: [{ id: 'support-progress', email: 'progress@example.com' }]
    });
    expect(await csvResponse.text()).toContain('progress@example.com');
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'Invalid support request status filter.' });
  });

  it('blocks public brain dump execution until beta access is granted', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace(),
      betaAccessCode: 'founder-beta'
    });

    const requestBody = {
      requestId: 'req-beta',
      text: 'Buy coffee',
      timezone: 'America/Chicago'
    };
    const blocked = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })
    );
    const access = await backend.handle(
      new Request('https://api.example.com/api/beta/access', {
        method: 'POST',
        body: JSON.stringify({ code: 'founder-beta' })
      })
    );
    const allowed = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        headers: { Cookie: access.headers.get('Set-Cookie') ?? '' },
        body: JSON.stringify(requestBody)
      })
    );
    const result = await allowed.json();

    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ error: 'Beta access code is required.' });
    expect(allowed.status).toBe(200);
    expect(result.summary.personalTasks).toBe(1);
  });

  it('returns workspace and processes brain dumps through the public route', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace()
    });

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

  it('returns a clean error for malformed brain dump JSON', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace()
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: '{'
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON body.' });
  });

  it('validates required brain dump request fields', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace()
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-invalid',
          text: '',
          timezone: 'America/Chicago'
        })
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Brain dump text is required.' });
  });

  it('rejects brain dump JSON bodies over the configured size limit', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace(),
      requestLimits: {
        maxJsonBodyBytes: 32
      }
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-large',
          text: 'This is deliberately too long for the tiny test limit.',
          timezone: 'America/Chicago'
        })
      })
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Request body is too large.' });
  });

  it('returns the same response for duplicate request ids', async () => {
    const backend = createPublicBackend({ googleOAuth, workspace: connectedWorkspace() });
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

  it('uses an injected response store for duplicate request ids', async () => {
    const responseStore = createMemoryResponseStore();
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace(),
      responseStore,
      executor: {
        async execute(action) {
          return { status: 'created', message: `Created ${action.title}` };
        }
      }
    });

    await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-store',
          text: 'Buy coffee',
          timezone: 'America/Chicago'
        })
      })
    );

    expect(await responseStore.readResponse('req-store')).toMatchObject({ requestId: 'req-store' });
  });

  it('executes approved actions instead of reparsing the original text', async () => {
    const createdTitles: string[] = [];
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace(),
      executor: {
        async execute(action) {
          createdTitles.push(action.title);
          return { status: 'created', message: `Created ${action.title}` };
        }
      }
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-approved',
          text: 'Pay employees tomorrow. Lunch with Jack Thursday at noon; put on calendar.',
          timezone: 'America/Chicago',
          approvedActions: [
            {
              type: 'work_task',
              title: 'Pay employees tomorrow',
              status: 'planned',
              dueDate: 'tomorrow',
              notes: 'Pay employees tomorrow.',
              sourceText: 'Pay employees tomorrow.'
            }
          ]
        })
      })
    );
    const result = await response.json();

    expect(createdTitles).toEqual(['Pay employees tomorrow']);
    expect(result.summary.workTasks).toBe(1);
    expect(result.summary.calendar).toBe(0);
  });

  it('validates approved action payloads before execution', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace()
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-bad-action',
          text: 'Pay employees tomorrow.',
          timezone: 'America/Chicago',
          approvedActions: [
            {
              type: 'unknown_action',
              title: 'Pay employees tomorrow',
              sourceText: 'Pay employees tomorrow.'
            }
          ]
        })
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Approved action type is invalid.' });
  });

  it('blocks processing after disconnect', async () => {
    const backend = createPublicBackend({ googleOAuth, workspace: connectedWorkspace() });

    await backend.handle(new Request('https://api.example.com/api/auth/google/disconnect', { method: 'POST' }));
    const response = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({ requestId: 'req-2', text: 'Buy coffee', timezone: 'America/Chicago' })
      })
    );

    expect(response.status).toBe(409);
  });

  it('uses the injected executor and returns execution failures', async () => {
    const executionLogStore = createMemoryExecutionLogStore();
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace(),
      executionLogStore,
      now: () => new Date('2026-07-12T12:00:00.000Z'),
      executor: {
        async execute(action: ParsedAction) {
          return action.type === 'calendar'
            ? { status: 'error', message: 'Calendar write failed' }
            : { status: 'created', message: 'Created' };
        }
      }
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-executor',
          text: 'Lunch with Jack Thursday at noon; put on calendar.',
          timezone: 'America/Chicago'
        })
      })
    );
    const result = await response.json();

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['Calendar write failed']);
    expect(await executionLogStore.readByRequest('req-executor')).toEqual([
      {
        requestId: 'req-executor',
        userId: undefined,
        actionType: 'calendar',
        title: 'Lunch with Jack',
        status: 'error',
        message: 'Calendar write failed',
        providerId: undefined,
        createdAt: '2026-07-12T12:00:00.000Z'
      }
    ]);
  });

  it('passes request timezone into the executor context', async () => {
    let timezone = '';
    const backend = createPublicBackend({
      googleOAuth,
      workspace: connectedWorkspace(),
      executor: {
        async execute(_action, _workspace, context) {
          timezone = context?.timezone ?? '';
          return { status: 'created', message: 'Created' };
        }
      }
    });

    await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-timezone',
          text: 'Buy coffee',
          timezone: 'America/Chicago'
        })
      })
    );

    expect(timezone).toBe('America/Chicago');
  });

  it('starts and completes OAuth through backend routes', async () => {
    const store = createMemoryOAuthStore();
    const sessionStore = createMemorySessionStore(() => 1234);
    const backend = createPublicBackend({
      googleOAuth,
      oauthStore: store,
      sessionStore,
      tokenClient: fakeTokenClient()
    });

    const startResponse = await backend.handle(
      new Request('https://api.example.com/api/auth/google/start', { method: 'POST' })
    );
    const start = await startResponse.json();
    const authorization = new URL(start.authorizationUrl);

    expect(authorization.searchParams.get('state')).toBe(start.state);
    expect(store.states.has(start.state)).toBe(true);

    const callbackResponse = await backend.handle(
      new Request(`https://api.example.com/api/auth/google/callback?code=auth-code&state=${start.state}`)
    );
    const workspace = await callbackResponse.json();

    expect(workspace.status).toBe('connected');
    expect(workspace.email).toBe('user@example.com');
    expect(store.tokens.has('user@example.com')).toBe(true);
    expect(callbackResponse.headers.get('Set-Cookie')).toContain(`${sessionCookieName}=`);
    expect(sessionStore.sessions.size).toBe(1);
  });

  it('redirects OAuth callbacks back to the app when a frontend URL is configured', async () => {
    const store = createMemoryOAuthStore();
    const backend = createPublicBackend({
      googleOAuth,
      frontendAppUrl: 'https://app.example.com/app',
      oauthStore: store,
      tokenClient: fakeTokenClient()
    });

    const startResponse = await backend.handle(
      new Request('https://api.example.com/api/auth/google/start', { method: 'POST' })
    );
    const start = await startResponse.json();
    const callbackResponse = await backend.handle(
      new Request(`https://api.example.com/api/auth/google/callback?code=auth-code&state=${start.state}`)
    );

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.get('Location')).toBe('https://app.example.com/app?connected=google');
    expect(callbackResponse.headers.get('Set-Cookie')).toContain(`${sessionCookieName}=`);
  });

  it('rejects callback requests with invalid state', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      oauthStore: createMemoryOAuthStore(),
      tokenClient: fakeTokenClient()
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/auth/google/callback?code=auth-code&state=bad')
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid OAuth state.' });
  });

  it('redirects OAuth callback errors back to the app when configured', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      frontendAppUrl: 'https://app.example.com/app',
      oauthStore: createMemoryOAuthStore(),
      tokenClient: fakeTokenClient()
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/auth/google/callback?code=auth-code&state=bad')
    );
    const location = new URL(response.headers.get('Location') ?? '');

    expect(response.status).toBe(302);
    expect(location.origin + location.pathname).toBe('https://app.example.com/app');
    expect(location.searchParams.get('connection')).toBe('error');
    expect(location.searchParams.get('reason')).toBe('Invalid OAuth state.');
  });

  it('uses session cookies to read workspace and process requests', async () => {
    const oauthStore = createMemoryOAuthStore();
    const sessionStore = createMemorySessionStore(() => 1234);
    const executionLogStore = createMemoryExecutionLogStore();
    await oauthStore.saveWorkspace('user@example.com', connectedWorkspace());
    const session = await sessionStore.createSession('user@example.com');
    const backend = createPublicBackend({
      googleOAuth,
      oauthStore,
      sessionStore,
      executionLogStore,
      now: () => new Date('2026-07-12T12:00:00.000Z')
    });

    const workspaceResponse = await backend.handle(
      new Request('https://api.example.com/api/workspace', {
        headers: { Cookie: `${sessionCookieName}=${session.id}` }
      })
    );
    const workspace = await workspaceResponse.json();
    expect(workspace.status).toBe('connected');

    const processResponse = await backend.handle(
      new Request('https://api.example.com/api/brain-dump', {
        method: 'POST',
        headers: { Cookie: `${sessionCookieName}=${session.id}` },
        body: JSON.stringify({
          requestId: 'req-session',
          text: 'Buy coffee',
          timezone: 'America/Chicago'
        })
      })
    );
    const result = await processResponse.json();
    expect(result.summary.personalTasks).toBe(1);
    expect(await executionLogStore.readByRequest('req-session')).toMatchObject([
      {
        requestId: 'req-session',
        userId: 'user@example.com',
        actionType: 'personal_task',
        title: 'Buy coffee',
        status: 'created',
        createdAt: '2026-07-12T12:00:00.000Z'
      }
    ]);
  });

  it('clears the session on disconnect', async () => {
    const sessionStore = createMemorySessionStore(() => 1234);
    const oauthStore = createMemoryOAuthStore();
    await oauthStore.saveTokens('user@example.com', {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 2000,
      scope: googleOAuth.scopes.join(' ')
    });
    await oauthStore.saveWorkspace('user@example.com', connectedWorkspace());
    const session = await sessionStore.createSession('user@example.com');
    const backend = createPublicBackend({ googleOAuth, oauthStore, sessionStore });

    const response = await backend.handle(
      new Request('https://api.example.com/api/auth/google/disconnect', {
        method: 'POST',
        headers: { Cookie: `${sessionCookieName}=${session.id}` }
      })
    );

    expect(await sessionStore.readSession(session.id)).toBeUndefined();
    expect(await oauthStore.readTokens('user@example.com')).toBeUndefined();
    expect(await oauthStore.readWorkspace('user@example.com')).toBeUndefined();
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('requires a signed-in session before deleting account data', async () => {
    const backend = createPublicBackend({ googleOAuth });

    const response = await backend.handle(
      new Request('https://api.example.com/api/account/delete', {
        method: 'POST'
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Not signed in.' });
  });

  it('deletes signed-in user account records without deleting other users', async () => {
    const sessionStore = createMemorySessionStore(() => 1234);
    const oauthStore = createMemoryOAuthStore();
    const responseStore = createMemoryResponseStore();
    const executionLogStore = createMemoryExecutionLogStore();
    const analyticsStore = createMemoryAnalyticsStore();
    await oauthStore.saveTokens('user@example.com', {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 2000,
      scope: googleOAuth.scopes.join(' ')
    });
    await oauthStore.saveWorkspace('user@example.com', connectedWorkspace());
    await oauthStore.saveTokens('other@example.com', {
      accessToken: 'other-access-token',
      refreshToken: 'other-refresh-token',
      expiresAt: 2000,
      scope: googleOAuth.scopes.join(' ')
    });
    await oauthStore.saveWorkspace('other@example.com', connectedWorkspace());
    const session = await sessionStore.createSession('user@example.com');
    await responseStore.saveResponse('req-user', responseFixture('req-user'), 'user@example.com');
    await responseStore.saveResponse('req-other', responseFixture('req-other'), 'other@example.com');
    await executionLogStore.append({
      requestId: 'req-user',
      userId: 'user@example.com',
      actionType: 'personal_task',
      title: 'Buy coffee',
      status: 'created',
      message: 'Created',
      createdAt: '2026-07-12T12:00:00.000Z'
    });
    await executionLogStore.append({
      requestId: 'req-other',
      userId: 'other@example.com',
      actionType: 'personal_task',
      title: 'Buy tea',
      status: 'created',
      message: 'Created',
      createdAt: '2026-07-12T12:01:00.000Z'
    });
    await analyticsStore.append({
      name: 'create_completed',
      requestId: 'req-user',
      userId: 'user@example.com',
      createdAt: '2026-07-12T12:00:00.000Z'
    });
    await analyticsStore.append({
      name: 'create_completed',
      requestId: 'req-other',
      userId: 'other@example.com',
      createdAt: '2026-07-12T12:01:00.000Z'
    });
    const backend = createPublicBackend({
      googleOAuth,
      oauthStore,
      sessionStore,
      responseStore,
      executionLogStore,
      analyticsStore
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/account/delete', {
        method: 'POST',
        headers: { Cookie: `${sessionCookieName}=${session.id}` }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toContain('google_tokens');
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(await sessionStore.readSession(session.id)).toBeUndefined();
    expect(await oauthStore.readTokens('user@example.com')).toBeUndefined();
    expect(await oauthStore.readWorkspace('user@example.com')).toBeUndefined();
    expect(await responseStore.readResponse('req-user')).toBeUndefined();
    expect(await responseStore.readResponse('req-other')).toMatchObject({ requestId: 'req-other' });
    expect(await executionLogStore.readByRequest('req-user')).toEqual([]);
    expect(await executionLogStore.readByRequest('req-other')).toHaveLength(1);
    expect(await analyticsStore.readAll()).toMatchObject([{ requestId: 'req-other' }]);
    expect(await oauthStore.readTokens('other@example.com')).toMatchObject({ refreshToken: 'other-refresh-token' });
  });

  it('stores privacy-safe analytics events without brain dump text', async () => {
    const analyticsStore = createMemoryAnalyticsStore();
    const sessionStore = createMemorySessionStore(() => 1234);
    const session = await sessionStore.createSession('user@example.com');
    const backend = createPublicBackend({
      googleOAuth,
      sessionStore,
      analyticsStore,
      now: () => new Date('2026-07-12T12:00:00.000Z')
    });

    const response = await backend.handle(
      new Request('https://api.example.com/api/events', {
        method: 'POST',
        headers: { Cookie: `${sessionCookieName}=${session.id}` },
        body: JSON.stringify({
          name: 'review_created',
          requestId: 'req-analytics',
          text: 'Pay employees tomorrow',
          actionCount: 1
        })
      })
    );

    expect(response.status).toBe(200);
    expect(analyticsStore.records).toEqual([
      {
        name: 'review_created',
        requestId: 'req-analytics',
        actionCount: 1,
        userId: 'user@example.com',
        createdAt: '2026-07-12T12:00:00.000Z'
      }
    ]);
  });

  it('returns a clean error for malformed analytics JSON', async () => {
    const backend = createPublicBackend({ googleOAuth });

    const response = await backend.handle(
      new Request('https://api.example.com/api/events', {
        method: 'POST',
        body: '{'
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON body.' });
  });

  it('rate limits repeated public POST requests from the same client', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      requestLimits: {
        rateLimit: {
          windowMs: 60_000,
          maxRequests: 1
        }
      }
    });

    const first = await backend.handle(
      new Request('https://api.example.com/api/events', {
        method: 'POST',
        headers: { 'X-Forwarded-For': '203.0.113.10' },
        body: JSON.stringify({ name: 'app_opened' })
      })
    );
    const second = await backend.handle(
      new Request('https://api.example.com/api/events', {
        method: 'POST',
        headers: { 'X-Forwarded-For': '203.0.113.10' },
        body: JSON.stringify({ name: 'app_opened' })
      })
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBe('60');
    expect(await second.json()).toEqual({ error: 'Too many requests. Please try again shortly.' });
  });

  it('tracks rate limits separately for different client addresses', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      requestLimits: {
        rateLimit: {
          windowMs: 60_000,
          maxRequests: 1
        }
      }
    });

    const first = await backend.handle(
      new Request('https://api.example.com/api/events', {
        method: 'POST',
        headers: { 'X-Forwarded-For': '203.0.113.10' },
        body: JSON.stringify({ name: 'app_opened' })
      })
    );
    const second = await backend.handle(
      new Request('https://api.example.com/api/events', {
        method: 'POST',
        headers: { 'X-Forwarded-For': '203.0.113.11' },
        body: JSON.stringify({ name: 'app_opened' })
      })
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it('protects beta analytics metrics with an admin token', async () => {
    const analyticsStore = createMemoryAnalyticsStore();
    await analyticsStore.append({
      name: 'review_created',
      requestId: 'req-1',
      userId: 'user@example.com',
      actionCount: 2,
      createdAt: '2026-07-12T12:00:00.000Z'
    });
    const backend = createPublicBackend({
      googleOAuth,
      analyticsStore,
      adminToken: 'admin-secret'
    });

    const unauthorized = await backend.handle(new Request('https://api.example.com/api/admin/metrics'));
    const authorized = await backend.handle(
      new Request('https://api.example.com/api/admin/metrics', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-secret' }
      })
    );

    expect(unauthorized.status).toBe(401);
    expect(await authorized.json()).toEqual({
      totalEvents: 1,
      uniqueUsers: 1,
      uniqueRequests: 1,
      totalActions: 2,
      totalErrors: 0,
      byName: {
        review_created: 1
      },
      latestEventAt: '2026-07-12T12:00:00.000Z'
    });
  });

  it('does not expose beta analytics metrics until configured', async () => {
    const backend = createPublicBackend({ googleOAuth });

    const response = await backend.handle(new Request('https://api.example.com/api/admin/metrics'));

    expect(response.status).toBe(404);
  });

  it('protects the beta backup plan with an admin token', async () => {
    const backend = createPublicBackend({
      googleOAuth,
      adminToken: 'admin-secret',
      storageKeyPrefix: 'prod',
      now: () => new Date('2026-07-12T12:00:00.000Z')
    });

    const unauthorized = await backend.handle(new Request('https://api.example.com/api/admin/backup-plan'));
    const authorized = await backend.handle(
      new Request('https://api.example.com/api/admin/backup-plan', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-secret' }
      })
    );
    const plan = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(plan).toMatchObject({
      generatedAt: '2026-07-12T12:00:00.000Z',
      storagePrefix: 'prod'
    });
    expect(JSON.stringify(plan)).toContain('Do not export tokens');
  });

  it('returns protected recent execution errors', async () => {
    const executionLogStore = createMemoryExecutionLogStore();
    await executionLogStore.append({
      requestId: 'req-created',
      userId: 'user@example.com',
      actionType: 'personal_task',
      title: 'Buy coffee',
      status: 'created',
      message: 'Created',
      createdAt: '2026-07-12T12:00:00.000Z'
    });
    await executionLogStore.append({
      requestId: 'req-error',
      userId: 'user@example.com',
      actionType: 'calendar',
      title: 'Lunch with Jack',
      status: 'error',
      message: 'Calendar write failed',
      createdAt: '2026-07-12T12:01:00.000Z'
    });
    const backend = createPublicBackend({
      googleOAuth,
      executionLogStore,
      adminToken: 'admin-secret'
    });

    const unauthorized = await backend.handle(new Request('https://api.example.com/api/admin/execution-errors'));
    const authorized = await backend.handle(
      new Request('https://api.example.com/api/admin/execution-errors?limit=5', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-secret' }
      })
    );
    const csv = await backend.handle(
      new Request('https://api.example.com/api/admin/execution-errors?format=csv', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-secret' }
      })
    );
    const body = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(csv.headers.get('Content-Disposition')).toContain('brain-dump-execution-errors.csv');
    expect(await csv.text()).toContain('Calendar write failed');
    expect(body.recentErrors).toEqual([
      {
        requestId: 'req-error',
        userId: 'user@example.com',
        actionType: 'calendar',
        title: 'Lunch with Jack',
        status: 'error',
        message: 'Calendar write failed',
        createdAt: '2026-07-12T12:01:00.000Z'
      }
    ]);
  });

  it('returns protected launch summary counts', async () => {
    const analyticsStore = createMemoryAnalyticsStore();
    const betaRequestStore = createMemoryBetaRequestStore();
    const feedbackStore = createMemoryFeedbackStore();
    const supportRequestStore = createMemorySupportRequestStore();
    const executionLogStore = createMemoryExecutionLogStore();
    await analyticsStore.append({
      name: 'create_failed',
      requestId: 'req-1',
      mode: 'public',
      actionCount: 2,
      errorCount: 1,
      userId: 'user@example.com',
      createdAt: '2026-07-17T12:00:00.000Z'
    });
    await betaRequestStore.append({
      id: 'beta-1',
      status: 'new',
      name: 'Jay Cleveland',
      email: 'jay@example.com',
      tools: 'Google Tasks',
      googleComfort: 'comfortable',
      createdAt: '2026-07-17T12:00:00.000Z'
    });
    await feedbackStore.append({
      id: 'feedback-1',
      status: 'reviewed',
      lookedRight: 'Tasks',
      confusing: 'Calendar',
      expected: 'Clearer review',
      createdAt: '2026-07-17T12:00:00.000Z'
    });
    await supportRequestStore.append({
      id: 'support-1',
      status: 'in_progress',
      email: 'user@example.com',
      issueType: 'google_connection',
      summary: 'Connection failed',
      details: 'OAuth state mismatch',
      createdAt: '2026-07-17T12:00:00.000Z'
    });
    await executionLogStore.append({
      requestId: 'req-1',
      actionType: 'calendar',
      title: 'Lunch',
      status: 'error',
      message: 'Calendar failed',
      createdAt: '2026-07-17T12:01:00.000Z'
    });
    const backend = createPublicBackend({
      googleOAuth,
      analyticsStore,
      betaRequestStore,
      feedbackStore,
      supportRequestStore,
      executionLogStore,
      adminToken: 'admin-secret',
      now: () => new Date('2026-07-17T12:05:00.000Z')
    });

    const unauthorized = await backend.handle(new Request('https://api.example.com/api/admin/launch-summary'));
    const authorized = await backend.handle(
      new Request('https://api.example.com/api/admin/launch-summary', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-secret' }
      })
    );

    expect(unauthorized.status).toBe(401);
    await expect(authorized.json()).resolves.toMatchObject({
      generatedAt: '2026-07-17T12:05:00.000Z',
      ready: false,
      totalEvents: 1,
      uniqueUsers: 1,
      totalErrors: 1,
      queueCounts: {
        beta: { new: 1, invited: 0, archived: 0 },
        feedback: { new: 0, reviewed: 1, archived: 0 },
        support: { new: 0, in_progress: 1, resolved: 0, archived: 0 },
        recentExecutionErrors: 1
      }
    });
  });

  it('returns protected launch readiness without exposing secrets', async () => {
    const backend = createPublicBackend({
      googleOAuth: {
        ...googleOAuth,
        scopes: [...googleOAuth.scopes, 'https://www.googleapis.com/auth/calendar.events']
      },
      frontendAppUrl: 'https://app.example.com/app',
      adminToken: 'admin-secret',
      storageMode: 'durable',
      storageEncrypted: true,
      now: () => new Date('2026-07-12T12:00:00.000Z')
    });

    const unauthorized = await backend.handle(new Request('https://api.example.com/api/admin/readiness'));
    const authorized = await backend.handle(
      new Request('https://api.example.com/api/admin/readiness', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-secret' }
      })
    );
    const report = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(report.ready).toBe(true);
    expect(JSON.stringify(report)).not.toContain('client-secret');
  });

  it('returns a protected production self-test report', async () => {
    const backend = createPublicBackend({
      googleOAuth: {
        ...googleOAuth,
        scopes: [...googleOAuth.scopes, 'https://www.googleapis.com/auth/calendar.events']
      },
      frontendAppUrl: 'https://app.example.com/app',
      adminToken: 'admin-secret',
      storageMode: 'durable',
      storageEncrypted: true,
      betaAccessCode: 'founder-beta',
      requestLimits: { maxJsonBodyBytes: 65536, rateLimit: { maxRequests: 60 } },
      now: () => new Date('2026-07-18T12:00:00.000Z')
    });

    const unauthorized = await backend.handle(new Request('https://api.example.com/api/admin/self-test'));
    const authorized = await backend.handle(
      new Request('https://api.example.com/api/admin/self-test', {
        headers: { 'X-Brain-Dump-Admin-Token': 'admin-secret' }
      })
    );
    const report = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(report).toMatchObject({
      generatedAt: '2026-07-18T12:00:00.000Z',
      ok: true
    });
    expect(report.checks.map((check: { key: string }) => check.key)).toContain('beta_access_gate');
    expect(JSON.stringify(report)).not.toContain('founder-beta');
  });
});

function connectedWorkspace() {
  return {
    status: 'connected' as const,
    email: 'demo@braindump.local',
    destinations: [
      { id: 'tasks-work', name: 'Brain Dump Work', provider: 'google_tasks' as const, kind: 'work_tasks' as const, isDefault: true },
      { id: 'tasks-personal', name: 'Brain Dump Personal', provider: 'google_tasks' as const, kind: 'personal_tasks' as const, isDefault: true },
      { id: 'calendar', name: 'Brain Dump Calendar', provider: 'google_calendar' as const, kind: 'calendar' as const, isDefault: true },
      { id: 'projects', name: 'Brain Dump Projects', provider: 'brain_dump_workspace' as const, kind: 'projects' as const, isDefault: true },
      { id: 'waiting', name: 'Brain Dump Waiting On', provider: 'brain_dump_workspace' as const, kind: 'waiting' as const, isDefault: true }
    ]
  };
}

function responseFixture(requestId: string): BrainDumpResponse {
  return {
    ok: true,
    requestId,
    summary: {
      calendar: 0,
      workTasks: 0,
      personalTasks: 1,
      projects: 0,
      waiting: 0,
      needsReview: 0
    },
    actions: [
      {
        type: 'personal_task',
        title: 'Buy coffee',
        status: 'created',
        sourceText: 'Buy coffee'
      }
    ],
    errors: []
  };
}

function fakeTokenClient(): TokenExchangeClient {
  return {
    async exchangeCode() {
      return {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600,
        scope: googleOAuth.scopes.join(' ')
      };
    },
    async refreshTokens() {
      return {
        accessToken: 'new-access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600,
        scope: googleOAuth.scopes.join(' ')
      };
    },
    async readProfile() {
      return { email: 'user@example.com' };
    }
  };
}
