import { describe, expect, it } from 'vitest';
import { betaFollowUpMailto } from './betaFollowUp';
import type { BetaRequestRecord } from '../api/publicContract';

const request: BetaRequestRecord = {
  id: 'beta-1',
  status: 'invited',
  name: 'Jay Cleveland',
  email: 'jay@example.com',
  tools: 'Google Tasks',
  googleComfort: 'comfortable',
  notes: 'I want to test it.',
  createdAt: '2026-07-17T12:00:00.000Z'
};

describe('beta follow-up copy', () => {
  it('builds a safe first-run feedback follow-up email', () => {
    const href = betaFollowUpMailto(request, 'https://braindump.app/feedback');
    const decoded = decodeURIComponent(href);

    expect(href).toContain('mailto:jay%40example.com');
    expect(decoded).toContain('Hi Jay,');
    expect(decoded).toContain('What looked right?');
    expect(decoded).toContain('https://braindump.app/feedback');
    expect(decoded).toContain('Please do not send passwords');
  });
});
