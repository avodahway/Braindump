export type BackupPlanSection = {
  name: string;
  keys: string[];
  sensitivity: 'secret' | 'private' | 'operational';
  backupAction: string;
  restoreAction: string;
};

export type BackupPlan = {
  generatedAt: string;
  storagePrefix: string;
  sections: BackupPlanSection[];
  operatorChecklist: string[];
};

export function buildBackupPlan({
  storagePrefix = 'brain-dump',
  generatedAt = new Date().toISOString()
}: {
  storagePrefix?: string;
  generatedAt?: string;
} = {}): BackupPlan {
  return {
    generatedAt,
    storagePrefix,
    sections: [
      {
        name: 'OAuth tokens',
        keys: [`${storagePrefix}:google-tokens:{userEmail}`],
        sensitivity: 'secret',
        backupAction: 'Back up only through encrypted provider snapshots. Do not export tokens to local files.',
        restoreAction: 'Restore encrypted storage snapshot, then verify a test user can refresh Google access.'
      },
      {
        name: 'User workspaces',
        keys: [`${storagePrefix}:workspace:{userEmail}`],
        sensitivity: 'private',
        backupAction: 'Include in encrypted backend storage snapshots.',
        restoreAction: 'Restore snapshot and confirm /api/workspace returns connected destinations for a test user.'
      },
      {
        name: 'Sessions',
        keys: [`${storagePrefix}:session:{sessionId}`],
        sensitivity: 'private',
        backupAction: 'Short-lived; include in snapshots only if the storage provider captures them automatically.',
        restoreAction: 'Prefer forcing users to sign in again instead of restoring stale sessions.'
      },
      {
        name: 'Idempotency responses',
        keys: [`${storagePrefix}:brain-dump-response:{requestId}`],
        sensitivity: 'private',
        backupAction: 'Include in encrypted snapshots during beta to prevent duplicate writes after restore.',
        restoreAction: 'Restore with the same storage prefix before reopening the backend.'
      },
      {
        name: 'Execution logs',
        keys: [`${storagePrefix}:execution-log:{requestId}`],
        sensitivity: 'private',
        backupAction: 'Include in encrypted snapshots for support and incident review.',
        restoreAction: 'Restore alongside idempotency records so support history matches requests.'
      },
      {
        name: 'Analytics events',
        keys: [`${storagePrefix}:analytics-events`],
        sensitivity: 'operational',
        backupAction: 'May be exported as aggregate metrics; raw events should remain in protected backend storage.',
        restoreAction: 'Restore if trend continuity matters; otherwise start a new beta metrics window.'
      }
    ],
    operatorChecklist: [
      'Confirm backend storage encryption is enabled before inviting real users.',
      'Take a provider-level snapshot before every backend deploy during beta.',
      'Never download Google refresh tokens into spreadsheets, logs, or local support files.',
      'Test restore in staging with a non-production Google test account before relying on backups.',
      'After restore, verify health, OAuth workspace lookup, idempotency behavior, metrics, and disconnect.'
    ]
  };
}
