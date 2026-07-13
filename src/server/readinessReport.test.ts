import { describe, expect, it } from 'vitest';
import { buildReadinessReport } from './readinessReport';

describe('readiness report', () => {
  it('marks launch ready when all required deployment settings are present', () => {
    const report = buildReadinessReport({
      generatedAt: '2026-07-12T12:00:00.000Z',
      googleClientId: 'client-id',
      googleRedirectUri: 'https://api.example.com/api/auth/google/callback',
      googleScopes: ['https://www.googleapis.com/auth/tasks', 'https://www.googleapis.com/auth/calendar.events'],
      frontendAppUrl: 'https://app.example.com/app',
      adminTokenConfigured: true,
      storageMode: 'durable'
    });

    expect(report.ready).toBe(true);
    expect(report.checks.every((check) => check.ready)).toBe(true);
  });

  it('marks launch not ready when public beta safeguards are missing', () => {
    const report = buildReadinessReport({
      googleScopes: ['https://www.googleapis.com/auth/tasks'],
      adminTokenConfigured: false,
      storageMode: 'memory'
    });

    expect(report.ready).toBe(false);
    expect(report.checks.filter((check) => !check.ready).map((check) => check.key)).toEqual([
      'google_client_id',
      'google_redirect_uri',
      'google_scopes',
      'frontend_return_url',
      'admin_token',
      'durable_storage'
    ]);
  });
});
