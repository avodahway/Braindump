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

  it('renders the product tool at the app route', () => {
    renderAt('/app');

    expect(screen.getByRole('heading', { level: 1, name: 'Brain Dump' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "What's on your mind?" })).toBeInTheDocument();
    expect(screen.getByText('Setup progress')).toBeInTheDocument();
    expect(screen.getByText('Safe preview only. No Google account is connected.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Put everything here. Do not organize it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review/i })).toBeInTheDocument();
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
