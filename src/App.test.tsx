import { cleanup, render, screen } from '@testing-library/react';
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
    expect(screen.getByPlaceholderText('Put everything here. Do not organize it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Process/i })).toBeInTheDocument();
  });
});

function renderAt(path: string) {
  window.history.pushState({}, '', path);
  render(<App />);
}
