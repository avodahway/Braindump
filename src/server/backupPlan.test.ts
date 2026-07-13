import { describe, expect, it } from 'vitest';
import { buildBackupPlan } from './backupPlan';

describe('backup plan', () => {
  it('describes protected beta backup and restore categories', () => {
    const plan = buildBackupPlan({
      storagePrefix: 'prod',
      generatedAt: '2026-07-12T12:00:00.000Z'
    });

    expect(plan.generatedAt).toBe('2026-07-12T12:00:00.000Z');
    expect(plan.storagePrefix).toBe('prod');
    expect(plan.sections.map((section) => section.name)).toEqual([
      'OAuth tokens',
      'User workspaces',
      'Sessions',
      'Idempotency responses',
      'Execution logs',
      'Analytics events'
    ]);
    expect(plan.sections[0]).toMatchObject({
      sensitivity: 'secret',
      backupAction: expect.stringContaining('Do not export tokens')
    });
  });
});
