import { describe, expect, it, vi } from 'vitest';
import {
  deletePublicAccountData,
  getPublicAdminBackupPlan,
  getPublicAdminBetaRequests,
  getPublicAdminBetaRequestsCsv,
  getPublicAdminExecutionErrors,
  getPublicAdminExecutionErrorsCsv,
  getPublicAdminFeedback,
  getPublicAdminFeedbackCsv,
  getPublicAdminLaunchSummary,
  getPublicAdminMetrics,
  getPublicAdminReadiness,
  getPublicBetaAccessStatus,
  normalizeApiBaseUrl,
  processPublicBrainDump,
  publicApiUrl,
  redeemPublicBetaAccessCode,
  startPublicGoogleConnection,
  submitPublicBetaRequest,
  submitPublicFeedback,
  submitPublicSupportRequest,
  trackPublicEvent,
  updatePublicAdminBetaRequestStatus,
  updatePublicAdminFeedbackStatus,
  getPublicAdminSupportRequests,
  getPublicAdminSupportRequestsCsv,
  updatePublicAdminSupportRequestStatus
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

  it('submits beta requests through the public backend', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          request: {
            id: 'beta-1',
            status: 'new',
            name: 'Jay Cleveland',
            email: 'jay@example.com',
            tools: 'Google Tasks',
            googleComfort: 'comfortable',
            createdAt: '2026-07-17T12:00:00.000Z'
          }
        })
      )
    );

    await submitPublicBetaRequest(
      'https://api.example.com',
      {
        name: 'Jay Cleveland',
        email: 'jay@example.com',
        tools: 'Google Tasks',
        googleComfort: 'comfortable'
      },
      fetcher
    );

    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/beta/request', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jay Cleveland',
        email: 'jay@example.com',
        tools: 'Google Tasks',
        googleComfort: 'comfortable'
      })
    });
  });

  it('submits feedback through the public backend', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          feedback: {
            id: 'feedback-1',
            status: 'new',
            email: 'jay@example.com',
            lookedRight: 'Tasks were right.',
            confusing: 'Calendar felt unclear.',
            expected: 'More review guidance.',
            createdAt: '2026-07-17T12:00:00.000Z'
          }
        })
      )
    );

    await submitPublicFeedback(
      'https://api.example.com',
      {
        email: 'jay@example.com',
        lookedRight: 'Tasks were right.',
        confusing: 'Calendar felt unclear.',
        expected: 'More review guidance.'
      },
      fetcher
    );

    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/feedback', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'jay@example.com',
        lookedRight: 'Tasks were right.',
        confusing: 'Calendar felt unclear.',
        expected: 'More review guidance.'
      })
    });
  });

  it('submits support requests through the public backend', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          supportRequest: {
            id: 'support-1',
            status: 'new',
            email: 'user@example.com',
            issueType: 'google_connection',
            summary: 'Connection failed',
            details: 'OAuth callback showed an error.',
            createdAt: '2026-07-17T12:00:00.000Z'
          }
        })
      )
    );

    await submitPublicSupportRequest(
      'https://api.example.com',
      {
        email: 'user@example.com',
        issueType: 'google_connection',
        summary: 'Connection failed',
        details: 'OAuth callback showed an error.'
      },
      fetcher
    );

    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/support/request', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        issueType: 'google_connection',
        summary: 'Connection failed',
        details: 'OAuth callback showed an error.'
      })
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

  it('reads protected operator endpoints with the admin token header', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ totalEvents: 0, uniqueUsers: 0, uniqueRequests: 0, totalActions: 0, totalErrors: 0, byName: {} })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ready: true, generatedAt: '2026-07-17T12:00:00.000Z', checks: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ generatedAt: '2026-07-17T12:00:00.000Z', storagePrefix: 'prod', sections: [], operatorChecklist: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ generatedAt: '2026-07-17T12:00:00.000Z', ready: true, totalEvents: 0, uniqueUsers: 0, totalErrors: 0, queueCounts: { beta: { new: 0, invited: 0, archived: 0 }, feedback: { new: 0, reviewed: 0, archived: 0 }, support: { new: 0, in_progress: 0, resolved: 0, archived: 0 }, recentExecutionErrors: 0 } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recentErrors: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ requests: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ feedback: [] })));

    await getPublicAdminMetrics('https://api.example.com', 'admin-token', fetcher);
    await getPublicAdminReadiness('https://api.example.com', 'admin-token', fetcher);
    await getPublicAdminBackupPlan('https://api.example.com', 'admin-token', fetcher);
    await getPublicAdminLaunchSummary('https://api.example.com', 'admin-token', fetcher);
    await getPublicAdminExecutionErrors('https://api.example.com', 'admin-token', fetcher);
    await getPublicAdminBetaRequests('https://api.example.com', 'admin-token', fetcher);
    await getPublicAdminFeedback('https://api.example.com', 'admin-token', fetcher);

    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://api.example.com/api/admin/metrics', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.example.com/api/admin/readiness', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetcher).toHaveBeenNthCalledWith(3, 'https://api.example.com/api/admin/backup-plan', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetcher).toHaveBeenNthCalledWith(4, 'https://api.example.com/api/admin/launch-summary', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetcher).toHaveBeenNthCalledWith(5, 'https://api.example.com/api/admin/execution-errors', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetcher).toHaveBeenNthCalledWith(6, 'https://api.example.com/api/admin/beta-requests', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetcher).toHaveBeenNthCalledWith(7, 'https://api.example.com/api/admin/feedback', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
  });

  it('reads protected operator CSV exports with the admin token header', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('createdAt,requestId,title\n2026-07-17T12:00:00.000Z,req-1,Lunch'))
      .mockResolvedValueOnce(new Response('createdAt,name,email\n2026-07-17T12:00:00.000Z,Jay,jay@example.com'))
      .mockResolvedValueOnce(new Response('createdAt,email,lookedRight\n2026-07-17T12:00:00.000Z,user@example.com,Tasks'));

    await expect(getPublicAdminExecutionErrorsCsv('https://api.example.com', 'admin-token', fetcher)).resolves.toContain('req-1');
    await expect(getPublicAdminBetaRequestsCsv('https://api.example.com', 'admin-token', fetcher)).resolves.toContain(
      'jay@example.com'
    );
    await expect(getPublicAdminFeedbackCsv('https://api.example.com', 'admin-token', fetcher)).resolves.toContain('Tasks');

    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://api.example.com/api/admin/execution-errors?format=csv', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.example.com/api/admin/beta-requests?format=csv', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetcher).toHaveBeenNthCalledWith(3, 'https://api.example.com/api/admin/feedback?format=csv', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
  });

  it('updates beta request status through the protected operator API', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          request: {
            id: 'beta-1',
            status: 'invited',
            name: 'Jay Cleveland',
            email: 'jay@example.com',
            tools: 'Google Tasks',
            googleComfort: 'comfortable',
            createdAt: '2026-07-17T12:00:00.000Z',
            updatedAt: '2026-07-17T12:30:00.000Z'
          }
        })
      )
    );

    await updatePublicAdminBetaRequestStatus('https://api.example.com', 'admin-token', 'beta-1', 'invited', fetcher);

    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/admin/beta-request', {
      method: 'POST',
      headers: {
        'X-Brain-Dump-Admin-Token': 'admin-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: 'beta-1', status: 'invited' })
    });
  });

  it('updates feedback status through the protected operator API', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          feedback: {
            id: 'feedback-1',
            status: 'reviewed',
            lookedRight: 'Tasks were right.',
            confusing: 'Calendar felt unclear.',
            expected: 'More review guidance.',
            createdAt: '2026-07-17T12:00:00.000Z',
            updatedAt: '2026-07-17T12:30:00.000Z'
          }
        })
      )
    );

    await updatePublicAdminFeedbackStatus('https://api.example.com', 'admin-token', 'feedback-1', 'reviewed', fetcher);

    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/admin/feedback-item', {
      method: 'POST',
      headers: {
        'X-Brain-Dump-Admin-Token': 'admin-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: 'feedback-1', status: 'reviewed' })
    });
  });

  it('reads and updates support requests through protected operator APIs', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ supportRequests: [] })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            supportRequest: {
              id: 'support-1',
              status: 'resolved',
              email: 'user@example.com',
              issueType: 'google_connection',
              summary: 'Connection failed',
              details: 'OAuth callback showed an error.',
              createdAt: '2026-07-17T12:00:00.000Z',
              updatedAt: '2026-07-17T12:30:00.000Z'
            }
          })
        )
      );

    await getPublicAdminSupportRequests('https://api.example.com', 'admin-token', fetcher);
    await updatePublicAdminSupportRequestStatus('https://api.example.com', 'admin-token', 'support-1', 'resolved', fetcher);

    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://api.example.com/api/admin/support-requests', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.example.com/api/admin/support-request', {
      method: 'POST',
      headers: {
        'X-Brain-Dump-Admin-Token': 'admin-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: 'support-1', status: 'resolved' })
    });
  });

  it('reads support request CSV exports with the admin token header', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('createdAt,email\n2026-07-17,user@example.com'));

    await expect(getPublicAdminSupportRequestsCsv('https://api.example.com', 'admin-token', fetcher)).resolves.toContain(
      'user@example.com'
    );

    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/admin/support-requests?format=csv', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
  });
});
