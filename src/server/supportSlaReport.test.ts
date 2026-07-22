import { describe, expect, it } from 'vitest';
import { buildSupportSlaReport } from './supportSlaReport';
import type { SupportRequestRecord } from '../api/publicContract';

describe('support SLA report', () => {
  it('flags open support requests older than the threshold', () => {
    const report = buildSupportSlaReport({
      generatedAt: '2026-07-18T12:00:00.000Z',
      thresholdHours: 24,
      requests: [
        supportRequest('old', 'new', '2026-07-17T10:00:00.000Z'),
        supportRequest('recent', 'in_progress', '2026-07-18T10:00:00.000Z'),
        supportRequest('resolved', 'resolved', '2026-07-16T10:00:00.000Z')
      ]
    });

    expect(report).toMatchObject({
      ok: false,
      openCount: 2,
      overdueCount: 1,
      oldestOpenHours: 26,
      overdueRequests: [{ id: 'old', ageHours: 26 }]
    });
  });

  it('passes when there are no overdue open support requests', () => {
    const report = buildSupportSlaReport({
      generatedAt: '2026-07-18T12:00:00.000Z',
      requests: [supportRequest('recent', 'new', '2026-07-18T11:00:00.000Z')]
    });

    expect(report.ok).toBe(true);
    expect(report.overdueRequests).toEqual([]);
  });
});

function supportRequest(id: string, status: SupportRequestRecord['status'], createdAt: string): SupportRequestRecord {
  return {
    id,
    status,
    email: `${id}@example.com`,
    issueType: 'google_connection',
    summary: 'Connection failed',
    details: 'OAuth callback showed an error.',
    createdAt
  };
}
