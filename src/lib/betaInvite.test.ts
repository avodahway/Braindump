import { describe, expect, it } from 'vitest';
import { betaInvitationMailto } from './betaInvite';
import type { BetaRequestRecord } from '../api/publicContract';

const request: BetaRequestRecord = {
  id: 'beta-1',
  status: 'new',
  name: 'Jay Cleveland',
  email: 'jay@example.com',
  tools: 'Google Tasks',
  googleComfort: 'comfortable',
  notes: 'I want to test it.',
  createdAt: '2026-07-17T12:00:00.000Z'
};

describe('beta invitation copy', () => {
  it('builds a prefilled invitation email', () => {
    const href = betaInvitationMailto(request, 'https://braindump.app/app');

    expect(href).toContain('mailto:jay%40example.com');
    expect(decodeURIComponent(href)).toContain('Hi Jay,');
    expect(decodeURIComponent(href)).toContain('Open Brain Dump: https://braindump.app/app');
    expect(decodeURIComponent(href)).toContain('Email sending is not enabled during beta.');
  });

  it('falls back gracefully when no name is available', () => {
    const href = betaInvitationMailto({ ...request, name: '   ' }, 'https://braindump.app/app');

    expect(decodeURIComponent(href)).toContain('Hi there,');
  });
});
