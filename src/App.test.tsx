import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

describe('App routes', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('renders the public home page at the root route', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { level: 1, name: 'Brain Dump' })).toBeInTheDocument();
    expect(screen.getByText("Get it out. We'll handle the rest.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open app/i })).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: /Beta support/i })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:')
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
});

function renderAt(path: string) {
  window.history.pushState({}, '', path);
  render(<App />);
}
