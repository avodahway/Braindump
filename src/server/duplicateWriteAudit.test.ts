import { describe, expect, it } from 'vitest';
import { buildDuplicateWriteAudit } from './duplicateWriteAudit';
import type { ExecutionLogRecord } from './executionLogStore';

describe('duplicate write audit', () => {
  it('flags repeated created actions across request ids for the same user, type, and title', () => {
    const audit = buildDuplicateWriteAudit({
      generatedAt: '2026-07-18T12:00:00.000Z',
      records: [
        logRecord('req-1', 'Pay invoice'),
        logRecord('req-2', ' pay   invoice '),
        { ...logRecord('req-3', 'Pay invoice'), status: 'error' }
      ]
    });

    expect(audit).toMatchObject({
      generatedAt: '2026-07-18T12:00:00.000Z',
      ok: false,
      totalCreated: 2,
      duplicateGroups: [
        {
          title: 'pay invoice',
          count: 2,
          requestIds: ['req-1', 'req-2']
        }
      ]
    });
  });

  it('does not flag retries recorded under the same request id', () => {
    const audit = buildDuplicateWriteAudit({
      records: [logRecord('req-1', 'Pay invoice'), logRecord('req-1', 'Pay invoice')]
    });

    expect(audit.ok).toBe(true);
    expect(audit.duplicateGroups).toEqual([]);
  });
});

function logRecord(requestId: string, title: string): ExecutionLogRecord {
  return {
    requestId,
    userId: 'user@example.com',
    actionType: 'work_task',
    title,
    status: 'created',
    message: 'Created',
    providerId: `${requestId}-provider`,
    createdAt: `2026-07-18T12:0${requestId.endsWith('2') ? '2' : '1'}:00.000Z`
  };
}
