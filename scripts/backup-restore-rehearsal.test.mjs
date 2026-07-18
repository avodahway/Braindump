import { describe, expect, it, vi } from 'vitest';
import { normalizeOrigin, runBackupRestoreRehearsal, validateBackupPlan } from './backup-restore-rehearsal.mjs';

describe('backup restore rehearsal', () => {
  it('normalizes API origins', () => {
    expect(normalizeOrigin(' https://api.example.com/// ')).toBe('https://api.example.com');
  });

  it('validates required backup plan sections and secret handling', () => {
    expect(validateBackupPlan(planFixture()).ok).toBe(true);
    expect(validateBackupPlan({ sections: [], operatorChecklist: [] })).toMatchObject({
      ok: false,
      issues: expect.arrayContaining(['Missing backup section: OAuth tokens'])
    });
  });

  it('fetches the protected backup plan and prints a rehearsal checklist', async () => {
    const logger = { log: vi.fn(), error: vi.fn() };
    const fetchImpl = vi.fn(async () => jsonResponse(planFixture()));

    await expect(
      runBackupRestoreRehearsal({
        publicApiOrigin: 'https://api.example.com/',
        adminToken: 'admin-token',
        fetchImpl,
        logger
      })
    ).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledWith('https://api.example.com/api/admin/backup-plan', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(logger.log).toHaveBeenCalledWith('Backup restore rehearsal checklist is complete.');
  });
});

function planFixture() {
  return {
    generatedAt: '2026-07-18T12:00:00.000Z',
    storagePrefix: 'prod',
    sections: [
      {
        name: 'OAuth tokens',
        keys: ['prod:google-tokens:{userEmail}'],
        sensitivity: 'secret',
        backupAction: 'Do not export tokens to local files.',
        restoreAction: 'Restore encrypted storage snapshot.'
      },
      {
        name: 'User workspaces',
        keys: ['prod:workspace:{userEmail}'],
        sensitivity: 'private',
        backupAction: 'Include in encrypted snapshots.',
        restoreAction: 'Confirm /api/workspace.'
      },
      {
        name: 'Idempotency responses',
        keys: ['prod:brain-dump-response:{requestId}'],
        sensitivity: 'private',
        backupAction: 'Include in encrypted snapshots.',
        restoreAction: 'Reopen backend after restore.'
      },
      {
        name: 'Execution logs',
        keys: ['prod:execution-log:{requestId}'],
        sensitivity: 'private',
        backupAction: 'Include in encrypted snapshots.',
        restoreAction: 'Confirm support history.'
      }
    ],
    operatorChecklist: ['Snapshot before deploy.', 'Restore in staging.', 'Verify OAuth workspace lookup.']
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
