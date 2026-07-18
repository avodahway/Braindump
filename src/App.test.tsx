import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App routes', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('renders the public home page at the root route', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { level: 1, name: 'Brain Dump' })).toBeInTheDocument();
    expect(screen.getByText("Get it out. We'll handle the rest.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open app/i })).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: /Beta support/i })).toHaveAttribute(
      'href',
      '/support'
    );
  });

  it('renders the privacy page with Google data language', () => {
    renderAt('/privacy');

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Google user data' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /support@braindump.app/i })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:')
    );
  });

  it('renders the terms page with beta status language', () => {
    renderAt('/terms');

    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Beta status' })).toBeInTheDocument();
    expect(screen.getByText(/Brain Dump does not send email during beta/i)).toBeInTheDocument();
  });

  it('renders the support page with data request guidance', () => {
    renderAt('/support');

    expect(screen.getByRole('heading', { level: 1, name: 'Support' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Account and data requests' })).toBeInTheDocument();
    expect(screen.getByText(/Brain Dump support will not ask for your Google password/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /support@braindump.app/i })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:')
    );
  });

  it('renders the data deletion page with disconnect guidance', () => {
    renderAt('/data-deletion');

    expect(screen.getByRole('heading', { level: 1, name: 'Data Deletion' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Disconnect Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send deletion request/i })).toBeInTheDocument();
    expect(screen.getByText(/does not remove tasks or calendar events already created/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /support@braindump.app/i })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:')
    );
  });

  it('renders the beta feedback page with the three post-run questions', () => {
    renderAt('/feedback');

    expect(screen.getByRole('heading', { level: 1, name: 'Beta Feedback' })).toBeInTheDocument();
    expect(screen.getByLabelText('What looked right?')).toBeInTheDocument();
    expect(screen.getByLabelText('What looked wrong or confusing?')).toBeInTheDocument();
    expect(screen.getByLabelText('What did you expect Brain Dump to do instead?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /support@braindump.app/i })).toHaveAttribute(
      'href',
      expect.stringContaining('Brain%20Dump%20beta%20feedback')
    );
  });

  it('renders the beta access page with public-user expectations', () => {
    renderAt('/beta');

    expect(screen.getByRole('heading', { level: 1, name: 'Join The Beta' })).toBeInTheDocument();
    expect(screen.getByText(/Google connection is per user/i)).toBeInTheDocument();
    expect(screen.getByText(/Email sending is not part of the beta/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /support@braindump.app/i })).toHaveAttribute(
      'href',
      expect.stringContaining('Brain%20Dump%20beta%20access%20request')
    );
  });

  it('renders the public launch status page', () => {
    renderAt('/status');

    expect(screen.getByRole('heading', { level: 1, name: 'Launch Status' })).toBeInTheDocument();
    expect(screen.getByText('Private beta setup')).toBeInTheDocument();
    expect(screen.getByText('Reviewed only')).toBeInTheDocument();
    expect(screen.getByText('Not enabled')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^support$/i })[0]).toHaveAttribute('href', '/support');
  });

  it('renders the product tool at the app route', () => {
    renderAt('/app');

    expect(screen.getByRole('heading', { level: 1, name: 'Brain Dump' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "What's on your mind?" })).toBeInTheDocument();
    expect(screen.getByText('Setup progress')).toBeInTheDocument();
    expect(screen.getByText('Safe preview only. No Google account is connected.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Put everything here. Do not organize it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review/i })).toBeInTheDocument();
  });

  it('renders the operator dashboard shell', () => {
    renderAt('/operator');

    expect(screen.getByRole('heading', { level: 1, name: 'Operator Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Enter the production API URL and admin token to load launch readiness.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
  });

  it('loads protected operator dashboard data', async () => {
    localStorage.setItem(
      'brain-dump-settings',
      JSON.stringify({ backendMode: 'public', publicApiBaseUrl: 'https://api.example.com', backendUrl: '', sharedSecret: '' })
    );
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://api.example.com/api/admin/metrics') {
        return new Response(
          JSON.stringify({
            totalEvents: 7,
            uniqueUsers: 2,
            uniqueRequests: 3,
            totalActions: 5,
            totalErrors: 1,
            latestEventAt: '2026-07-17T12:00:00.000Z',
            byName: { create_failed: 1, create_completed: 2 }
          })
        );
      }
      if (url === 'https://api.example.com/api/admin/readiness') {
        return new Response(
          JSON.stringify({
            ready: false,
            generatedAt: '2026-07-17T12:00:00.000Z',
            checks: [
              { key: 'admin_token', label: 'Admin endpoints protected', ready: true, detail: 'Configured' },
              { key: 'storage_encryption', label: 'Storage encryption codec', ready: false, detail: 'Missing BRAIN_DUMP_STORAGE_SECRET' }
            ]
          })
        );
      }
      if (url === 'https://api.example.com/api/admin/backup-plan') {
        return new Response(
          JSON.stringify({
            generatedAt: '2026-07-17T12:00:00.000Z',
            storagePrefix: 'prod',
            sections: [{ name: 'OAuth tokens', keys: [], sensitivity: 'secret', backupAction: 'Snapshot', restoreAction: 'Restore' }],
            operatorChecklist: ['Take a provider-level snapshot before deploy.']
          })
        );
      }
      if (url === 'https://api.example.com/api/admin/execution-errors') {
        return new Response(
          JSON.stringify({
            recentErrors: [
              {
                requestId: 'req-error',
                userId: 'user@example.com',
                actionType: 'calendar',
                title: 'Lunch with Jack',
                status: 'error',
                message: 'Calendar write failed',
                createdAt: '2026-07-17T12:00:00.000Z'
              }
            ]
          })
        );
      }
      if (url === 'https://api.example.com/api/admin/beta-requests') {
        return new Response(
          JSON.stringify({
            requests: [
              {
                id: 'beta-1',
                status: 'new',
                name: 'Jay Cleveland',
                email: 'jay@example.com',
                tools: 'Google Tasks',
                googleComfort: 'comfortable',
                notes: 'I want to test it.',
                createdAt: '2026-07-17T12:00:00.000Z'
              }
            ]
          })
        );
      }
      if (url === 'https://api.example.com/api/admin/feedback') {
        return new Response(
          JSON.stringify({
            feedback: [
              {
                id: 'feedback-1',
                status: 'new',
                email: 'user@example.com',
                requestId: 'req-1',
                lookedRight: 'Tasks were right.',
                confusing: 'Calendar felt unclear.',
                expected: 'More review guidance.',
                createdAt: '2026-07-17T12:00:00.000Z'
              }
            ]
          })
        );
      }
      if (url === 'https://api.example.com/api/admin/beta-request') {
        return new Response(
          JSON.stringify({
            ok: true,
            request: {
              id: 'beta-1',
              status: 'invited',
              name: 'Jay Cleveland',
              email: 'jay@example.com',
              tools: 'Google Tasks',
              googleComfort: 'comfortable',
              notes: 'I want to test it.',
              createdAt: '2026-07-17T12:00:00.000Z',
              updatedAt: '2026-07-17T12:30:00.000Z'
            }
          })
        );
      }
      if (url === 'https://api.example.com/api/admin/feedback-item') {
        return new Response(
          JSON.stringify({
            ok: true,
            feedback: {
              id: 'feedback-1',
              status: 'reviewed',
              email: 'user@example.com',
              requestId: 'req-1',
              lookedRight: 'Tasks were right.',
              confusing: 'Calendar felt unclear.',
              expected: 'More review guidance.',
              createdAt: '2026-07-17T12:00:00.000Z',
              updatedAt: '2026-07-17T12:30:00.000Z'
            }
          })
        );
      }
      if (url === 'https://api.example.com/api/admin/support-requests') {
        return new Response(
          JSON.stringify({
            supportRequests: [
              {
                id: 'support-1',
                status: 'new',
                email: 'user@example.com',
                issueType: 'google_connection',
                summary: 'Connection failed',
                details: 'OAuth callback showed an error.',
                createdAt: '2026-07-17T12:00:00.000Z'
              }
            ]
          })
        );
      }
      if (url === 'https://api.example.com/api/admin/support-request') {
        return new Response(
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
        );
      }
      return new Response(JSON.stringify({ ok: true }));
    });
    vi.stubGlobal('fetch', fetcher);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:csv-export') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderAt('/operator');

    fireEvent.change(screen.getByPlaceholderText('BRAIN_DUMP_ADMIN_TOKEN'), { target: { value: 'admin-token' } });
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    expect(await screen.findByText('Storage encryption codec')).toBeInTheDocument();
    expect(screen.getByText('Missing BRAIN_DUMP_STORAGE_SECRET')).toBeInTheDocument();
    expect(screen.getByText('OAuth tokens')).toBeInTheDocument();
    expect(screen.getByText('Recent Execution Errors')).toBeInTheDocument();
    expect(screen.getByText('Lunch with Jack')).toBeInTheDocument();
    expect(screen.getByText('Calendar write failed')).toBeInTheDocument();
    expect(screen.getByText('Blocking Issues (1)')).toBeInTheDocument();
    expect(screen.getByText('Ready Checks (1)')).toBeInTheDocument();
    expect(screen.getByText('Beta Queue')).toBeInTheDocument();
    expect(screen.getByText('Feedback Queue')).toBeInTheDocument();
    expect(screen.getByText('Support Queue')).toBeInTheDocument();
    expect(screen.getByText('in progress')).toBeInTheDocument();
    expect(screen.getByText('Beta Requests')).toBeInTheDocument();
    expect(screen.getByText('jay@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('new').length).toBeGreaterThanOrEqual(3);
    fireEvent.click(screen.getByRole('button', { name: /Mark invited/i }));
    expect(await screen.findByText('invited')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/admin/beta-request', {
      method: 'POST',
      headers: {
        'X-Brain-Dump-Admin-Token': 'admin-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: 'beta-1', status: 'invited' })
    });
    expect(screen.getByText('Beta Feedback')).toBeInTheDocument();
    expect(screen.getByText('Tasks were right.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Mark reviewed/i }));
    expect(await screen.findByText('reviewed')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/admin/feedback-item', {
      method: 'POST',
      headers: {
        'X-Brain-Dump-Admin-Token': 'admin-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: 'feedback-1', status: 'reviewed' })
    });
    expect(screen.getByText('Support Requests')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Resolve/i }));
    expect(await screen.findByText('resolved')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/admin/support-request', {
      method: 'POST',
      headers: {
        'X-Brain-Dump-Admin-Token': 'admin-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: 'support-1', status: 'resolved' })
    });
    expect(screen.getAllByRole('button', { name: /Export CSV/i })).toHaveLength(3);
    expect(screen.getByText('Take a provider-level snapshot before deploy.')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/admin/metrics', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/admin/execution-errors', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/admin/beta-requests', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/admin/feedback', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });

    fetcher.mockResolvedValueOnce(new Response('createdAt,name,email\n2026-07-17T12:00:00.000Z,Jay,jay@example.com'));
    fireEvent.click(screen.getAllByRole('button', { name: /Export CSV/i })[0]);
    expect(await screen.findByText('Beta Requests')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/admin/beta-requests?format=csv', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    fetcher.mockResolvedValueOnce(new Response('createdAt,email\n2026-07-17,user@example.com'));
    fireEvent.click(screen.getAllByRole('button', { name: /Export CSV/i })[2]);
    expect(await screen.findByText('Support Requests')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/admin/support-requests?format=csv', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
  });

  it('submits support requests from the public support page', async () => {
    localStorage.setItem(
      'brain-dump-settings',
      JSON.stringify({ backendMode: 'public', publicApiBaseUrl: 'https://api.example.com', backendUrl: '', sharedSecret: '' })
    );
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === 'https://api.example.com/api/support/request') {
        return new Response(
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
        );
      }
      return new Response(JSON.stringify({ ok: true }));
    });
    vi.stubGlobal('fetch', fetcher);
    renderAt('/support');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Issue type'), { target: { value: 'google_connection' } });
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'Connection failed' } });
    fireEvent.change(screen.getByLabelText('Details'), { target: { value: 'OAuth callback showed an error.' } });
    fireEvent.click(screen.getByRole('button', { name: /Send support request/i }));

    expect(await screen.findByText('Support request sent. We will follow up by email.')).toBeInTheDocument();
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

  it('submits data deletion requests through the support pipeline', async () => {
    localStorage.setItem(
      'brain-dump-settings',
      JSON.stringify({ backendMode: 'public', publicApiBaseUrl: 'https://api.example.com', backendUrl: '', sharedSecret: '' })
    );
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === 'https://api.example.com/api/support/request') {
        return new Response(
          JSON.stringify({
            ok: true,
            supportRequest: {
              id: 'support-2',
              status: 'new',
              email: 'user@example.com',
              issueType: 'account_or_data',
              summary: 'Data deletion request',
              details: 'Please delete my stored Brain Dump records.',
              createdAt: '2026-07-17T12:00:00.000Z'
            }
          })
        );
      }
      return new Response(JSON.stringify({ ok: true }));
    });
    vi.stubGlobal('fetch', fetcher);
    renderAt('/data-deletion');

    fireEvent.change(screen.getByLabelText('Google account email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Request details'), {
      target: { value: 'Please delete my stored Brain Dump records.' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Send deletion request/i }));

    expect(await screen.findByText('Data deletion request sent. We will follow up by email.')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/support/request', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        issueType: 'account_or_data',
        summary: 'Data deletion request',
        details: 'Please delete my stored Brain Dump records.'
      })
    });
  });

  it('submits feedback from the public feedback page', async () => {
    localStorage.setItem(
      'brain-dump-settings',
      JSON.stringify({ backendMode: 'public', publicApiBaseUrl: 'https://api.example.com', backendUrl: '', sharedSecret: '' })
    );
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === 'https://api.example.com/api/feedback') {
        return new Response(
          JSON.stringify({
            ok: true,
            feedback: {
              id: 'feedback-1',
              status: 'new',
              email: 'user@example.com',
              lookedRight: 'Tasks were right.',
              confusing: 'Calendar felt unclear.',
              expected: 'More review guidance.',
              createdAt: '2026-07-17T12:00:00.000Z'
            }
          })
        );
      }
      return new Response(JSON.stringify({ ok: true }));
    });
    vi.stubGlobal('fetch', fetcher);
    renderAt('/feedback');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('What looked right?'), { target: { value: 'Tasks were right.' } });
    fireEvent.change(screen.getByLabelText('What looked wrong or confusing?'), { target: { value: 'Calendar felt unclear.' } });
    fireEvent.change(screen.getByLabelText('What did you expect Brain Dump to do instead?'), {
      target: { value: 'More review guidance.' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Send feedback/i }));

    expect(await screen.findByText('Feedback sent. Thank you for helping shape the beta.')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/feedback', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        requestId: '',
        lookedRight: 'Tasks were right.',
        confusing: 'Calendar felt unclear.',
        expected: 'More review guidance.'
      })
    });
  });

  it('submits beta access requests from the public beta page', async () => {
    localStorage.setItem(
      'brain-dump-settings',
      JSON.stringify({ backendMode: 'public', publicApiBaseUrl: 'https://api.example.com', backendUrl: '', sharedSecret: '' })
    );
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === 'https://api.example.com/api/beta/request') {
        return new Response(
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
        );
      }
      return new Response(JSON.stringify({ ok: true }));
    });
    vi.stubGlobal('fetch', fetcher);
    renderAt('/beta');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jay Cleveland' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jay@example.com' } });
    fireEvent.change(screen.getByLabelText('Current task or calendar tools'), { target: { value: 'Google Tasks' } });
    fireEvent.change(screen.getByLabelText('Google connection comfort'), { target: { value: 'comfortable' } });
    fireEvent.click(screen.getByRole('button', { name: /Request beta access/i }));

    expect(await screen.findByText("You're on the beta request list. We'll follow up when the next group opens.")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/beta/request', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jay Cleveland',
        email: 'jay@example.com',
        tools: 'Google Tasks',
        googleComfort: 'comfortable',
        notes: ''
      })
    });
  });

  it('shows demo connection readiness for public mode without a backend URL', async () => {
    localStorage.setItem(
      'brain-dump-settings',
      JSON.stringify({ backendMode: 'public', publicApiBaseUrl: '', backendUrl: '', sharedSecret: '' })
    );
    renderAt('/app');

    expect(screen.getByText('Public backend URL needed before real Google sign-in.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Demo/i }));

    expect(await screen.findByText('Demo Google workspace connected')).toBeInTheDocument();
    expect(screen.getByText('demo@braindump.local')).toBeInTheDocument();
    expect(screen.getByText('Demo-ready. Add the public API URL before inviting users.')).toBeInTheDocument();
    expect(screen.getByLabelText('Google destinations')).toBeInTheDocument();
  });

  it('requires confirmation before deleting public account data from settings', async () => {
    localStorage.setItem(
      'brain-dump-settings',
      JSON.stringify({ backendMode: 'public', publicApiBaseUrl: 'https://api.example.com', backendUrl: '', sharedSecret: '' })
    );
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://api.example.com/api/workspace') {
        return new Response(JSON.stringify({ status: 'connected', email: 'user@example.com', destinations: [] }));
      }
      if (url === 'https://api.example.com/api/account/delete') {
        return new Response(JSON.stringify({ ok: true, deleted: ['google_tokens', 'workspace'] }));
      }
      return new Response(JSON.stringify({ ok: true }));
    });
    vi.stubGlobal('fetch', fetcher);
    renderAt('/app');

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    expect(screen.getByRole('button', { name: /Delete account data/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByRole('button', { name: /Delete account data/i }));

    expect(await screen.findByText('Stored Brain Dump account records were deleted for this browser session.')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/account/delete', {
      method: 'POST',
      credentials: 'include'
    });
    expect(screen.getByText('Ready to start Google sign-in.')).toBeInTheDocument();
  });

  it('prompts for beta access before public Google connection', async () => {
    localStorage.setItem(
      'brain-dump-settings',
      JSON.stringify({ backendMode: 'public', publicApiBaseUrl: 'https://api.example.com', backendUrl: '', sharedSecret: '' })
    );
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://api.example.com/api/beta/status') {
        return new Response(JSON.stringify({ required: true, granted: false }));
      }
      if (url === 'https://api.example.com/api/workspace') {
        return new Response(JSON.stringify({ status: 'not_connected', destinations: [] }));
      }
      if (url === 'https://api.example.com/api/beta/access') {
        return new Response(JSON.stringify({ ok: true, access: { required: true, granted: true } }));
      }
      return new Response(JSON.stringify({ ok: true }));
    });
    vi.stubGlobal('fetch', fetcher);
    renderAt('/app');

    expect(await screen.findByText('Beta access required')).toBeInTheDocument();
    expect(screen.getByText('Beta access code needed before Google sign-in.')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Beta access code'), { target: { value: 'founder-beta' } });
    fireEvent.click(screen.getByRole('button', { name: /Unlock/i }));

    expect(await screen.findByText('Beta access confirmed. You can connect Google when ready.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Beta access code')).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/api/beta/access', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'founder-beta' })
    });
  });

  it('shows a friendly message after Google callback success', () => {
    renderAt('/app?connected=google');

    expect(screen.getByText('Google connected. Your workspace is ready for reviewed actions.')).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('shows a friendly message after Google callback failure', () => {
    renderAt('/app?connection=error&reason=Invalid%20OAuth%20state.');

    expect(screen.getByText('Google connection failed: Invalid OAuth state.')).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('previews actions before creating them', () => {
    renderAt('/app');

    fireEvent.change(screen.getByPlaceholderText('Put everything here. Do not organize it.'), {
      target: { value: 'Pay employees tomorrow. Lunch with Jack Thursday at noon; put on calendar.' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Review/i }));

    expect(screen.getByText('Review before creating')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Work Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create/i })).toBeInTheDocument();
  });

  it('removes individual preview actions before creating', () => {
    renderAt('/app');

    fireEvent.change(screen.getByPlaceholderText('Put everything here. Do not organize it.'), {
      target: { value: 'Pay employees tomorrow. Lunch with Jack Thursday at noon; put on calendar.' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Review/i }));
    fireEvent.click(screen.getByRole('button', { name: /Remove Lunch with Jack/i }));

    expect(screen.queryByText('Lunch with Jack')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Calendar' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Work Tasks' })).toBeInTheDocument();
  });

  it('keeps unsafe calendar blocks in review after mock create', async () => {
    renderAt('/app');

    fireEvent.change(screen.getByPlaceholderText('Put everything here. Do not organize it.'), {
      target: { value: 'Spend 4 hours this week on the porch replacement project' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Review/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create/i }));

    expect(await screen.findByRole('heading', { name: 'Needs Review' })).toBeInTheDocument();
    expect(screen.getByText('Calendar needs review: Spend this week on the porch replacement project work block')).toBeInTheDocument();
  });

  it('keeps reviewed actions available when public creation fails', async () => {
    localStorage.setItem(
      'brain-dump-settings',
      JSON.stringify({ backendMode: 'public', publicApiBaseUrl: 'https://api.example.com', backendUrl: '', sharedSecret: '' })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === 'https://api.example.com/api/workspace') {
          return new Response(JSON.stringify({ status: 'connected', email: 'user@example.com', destinations: [] }));
        }
        if (url === 'https://api.example.com/api/brain-dump') {
          return new Response(JSON.stringify({ error: 'Google workspace is not connected.' }), { status: 409 });
        }
        return new Response(JSON.stringify({ ok: true }));
      })
    );
    renderAt('/app');

    fireEvent.change(screen.getByPlaceholderText('Put everything here. Do not organize it.'), {
      target: { value: 'Pay employees tomorrow' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Review/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create/i }));

    expect(await screen.findByText('Google workspace is not connected.')).toBeInTheDocument();
    expect(screen.getByText('Your reviewed actions are still here. Try again, or send support the error and what you expected.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Work Tasks' })).toBeInTheDocument();
  });

  it('tracks review and create events without sending brain dump text', async () => {
    localStorage.setItem(
      'brain-dump-settings',
      JSON.stringify({ backendMode: 'public', publicApiBaseUrl: 'https://api.example.com', backendUrl: '', sharedSecret: '' })
    );
    const fetcher = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://api.example.com/api/workspace') {
        return new Response(JSON.stringify({ status: 'connected', email: 'user@example.com', destinations: [] }));
      }
      if (url === 'https://api.example.com/api/brain-dump') {
        return new Response(
          JSON.stringify({
            ok: true,
            requestId: 'req-public-create',
            summary: { calendar: 0, workTasks: 1, personalTasks: 0, projects: 0, waiting: 0, needsReview: 0 },
            actions: [
              {
                type: 'work_task',
                title: 'Pay employees tomorrow',
                status: 'created',
                sourceText: 'Pay employees tomorrow'
              }
            ],
            errors: []
          })
        );
      }
      return new Response(JSON.stringify({ ok: true }));
    });
    vi.stubGlobal('fetch', fetcher);
    renderAt('/app');

    fireEvent.change(screen.getByPlaceholderText('Put everything here. Do not organize it.'), {
      target: { value: 'Pay employees tomorrow' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Review/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create/i }));

    await screen.findByText('Pay employees tomorrow');
    const eventBodies = fetcher.mock.calls
      .filter(([url]) => String(url) === 'https://api.example.com/api/events')
      .map(([, init]) => JSON.parse(String(init?.body)));

    expect(eventBodies.map((body) => body.name)).toContain('review_created');
    expect(JSON.stringify(eventBodies)).not.toContain('Pay employees tomorrow');
  });

  it('shows recovery guidance when provider execution returns errors', async () => {
    localStorage.setItem(
      'brain-dump-settings',
      JSON.stringify({
        backendMode: 'private_apps_script',
        publicApiBaseUrl: '',
        backendUrl: 'https://script.example.com',
        sharedSecret: ''
      })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: false,
            requestId: 'req-error',
            summary: { calendar: 0, workTasks: 0, personalTasks: 0, projects: 0, waiting: 0, needsReview: 0 },
            actions: [
              {
                type: 'work_task',
                title: 'Pay employees tomorrow',
                status: 'error',
                notes: 'Google Tasks write failed',
                sourceText: 'Pay employees tomorrow'
              }
            ],
            errors: ['Google Tasks write failed']
          })
        )
      )
    );
    renderAt('/app');

    fireEvent.change(screen.getByPlaceholderText('Put everything here. Do not organize it.'), {
      target: { value: 'Pay employees tomorrow' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Review/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create/i }));

    expect(await screen.findByText('Some items need attention')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Errors' })).toBeInTheDocument();
    expect(screen.getByText('Google Tasks write failed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Send report/i })).toHaveAttribute('href', expect.stringContaining('mailto:'));
  });
});

function renderAt(path: string) {
  window.history.pushState({}, '', path);
  render(<App />);
}
