import { describe, expect, it } from 'vitest';
import { buildBetaCohortReadiness } from './betaCohortReadiness';

describe('beta cohort readiness report', () => {
  it('recommends a next cohort when launch gates are healthy', () => {
    const report = buildBetaCohortReadiness({
      generatedAt: '2026-07-18T12:00:00.000Z',
      readiness: { generatedAt: '2026-07-18T12:00:00.000Z', ready: true, checks: [] },
      selfTest: { generatedAt: '2026-07-18T12:00:00.000Z', ok: true, checks: [] },
      duplicateWriteAudit: { generatedAt: '2026-07-18T12:00:00.000Z', ok: true, totalCreated: 4, duplicateGroups: [] },
      supportSla: {
        generatedAt: '2026-07-18T12:00:00.000Z',
        ok: true,
        thresholdHours: 24,
        openCount: 1,
        overdueCount: 0,
        overdueRequests: []
      },
      betaRequests: [
        betaRequest('req-1', 'new'),
        betaRequest('req-2', 'new'),
        betaRequest('req-3', 'new'),
        betaRequest('req-4', 'invited')
      ],
      feedback: [feedbackRecord('feedback-1', 'reviewed')],
      recentErrors: []
    });

    expect(report).toMatchObject({
      ok: true,
      recommendedNextCohortSize: 3,
      queueCounts: {
        betaNew: 3,
        betaInvited: 1,
        feedbackNew: 0,
        supportOpen: 1,
        executionErrors: 0
      }
    });
  });

  it('blocks the next cohort when operational gates are failing', () => {
    const report = buildBetaCohortReadiness({
      readiness: {
        generatedAt: '2026-07-18T12:00:00.000Z',
        ready: false,
        checks: [{ key: 'storage', label: 'Storage', ready: false, detail: 'Missing durable storage' }]
      },
      selfTest: {
        generatedAt: '2026-07-18T12:00:00.000Z',
        ok: false,
        checks: [{ key: 'rate_limit', label: 'Rate limit', ok: false, detail: 'Missing rate limit' }]
      },
      duplicateWriteAudit: {
        generatedAt: '2026-07-18T12:00:00.000Z',
        ok: false,
        totalCreated: 2,
        duplicateGroups: [
          {
            key: 'user|task|call sam',
            userId: 'user',
            actionType: 'work_task',
            title: 'call sam',
            count: 2,
            requestIds: ['req-1', 'req-2'],
            providerIds: ['task-1', 'task-2'],
            latestCreatedAt: '2026-07-18T11:00:00.000Z'
          }
        ]
      },
      supportSla: {
        generatedAt: '2026-07-18T12:00:00.000Z',
        ok: false,
        thresholdHours: 24,
        openCount: 2,
        overdueCount: 1,
        overdueRequests: [
          {
            id: 'support-1',
            email: 'user@example.com',
            issueType: 'google_connection',
            summary: 'OAuth failed',
            status: 'new',
            ageHours: 26,
            createdAt: '2026-07-17T10:00:00.000Z'
          }
        ]
      },
      betaRequests: [betaRequest('req-1', 'new')],
      feedback: [feedbackRecord('feedback-1', 'new')],
      recentErrors: [
        {
          requestId: 'run-1',
          actionType: 'work_task',
          title: 'Call Sam',
          status: 'error',
          message: 'Provider failed',
          createdAt: '2026-07-18T11:00:00.000Z'
        }
      ]
    });

    expect(report.ok).toBe(false);
    expect(report.recommendedNextCohortSize).toBe(0);
    expect(report.checks.filter((check) => !check.ok).map((check) => check.key)).toEqual([
      'production_readiness',
      'production_self_test',
      'duplicate_writes',
      'support_sla',
      'execution_errors'
    ]);
  });
});

function betaRequest(id: string, status: 'new' | 'invited' | 'archived') {
  return {
    id,
    name: 'Jay',
    email: `${id}@example.com`,
    tools: 'Google Tasks',
    googleComfort: 'comfortable',
    status,
    createdAt: '2026-07-18T10:00:00.000Z'
  };
}

function feedbackRecord(id: string, status: 'new' | 'reviewed' | 'archived') {
  return {
    id,
    email: `${id}@example.com`,
    lookedRight: 'Tasks',
    confusing: 'No',
    expected: 'Calendar event',
    status,
    createdAt: '2026-07-18T10:00:00.000Z'
  };
}
