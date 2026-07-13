export type ReadinessCheck = {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
};

export type ReadinessReport = {
  generatedAt: string;
  ready: boolean;
  checks: ReadinessCheck[];
};

export function buildReadinessReport({
  generatedAt = new Date().toISOString(),
  googleClientId,
  googleRedirectUri,
  googleScopes,
  frontendAppUrl,
  adminTokenConfigured,
  storageMode
}: {
  generatedAt?: string;
  googleClientId?: string;
  googleRedirectUri?: string;
  googleScopes?: string[];
  frontendAppUrl?: string;
  adminTokenConfigured: boolean;
  storageMode: 'memory' | 'durable';
}): ReadinessReport {
  const checks: ReadinessCheck[] = [
    {
      key: 'google_client_id',
      label: 'Google OAuth client ID',
      ready: Boolean(googleClientId),
      detail: googleClientId ? 'Configured' : 'Missing GOOGLE_CLIENT_ID'
    },
    {
      key: 'google_redirect_uri',
      label: 'Google OAuth redirect URI',
      ready: Boolean(googleRedirectUri),
      detail: googleRedirectUri ? 'Configured' : 'Missing BRAIN_DUMP_PUBLIC_API_ORIGIN'
    },
    {
      key: 'google_scopes',
      label: 'Google OAuth scopes',
      ready: Boolean(googleScopes?.includes('https://www.googleapis.com/auth/tasks') && googleScopes.includes('https://www.googleapis.com/auth/calendar.events')),
      detail: 'Requires Google Tasks and Calendar Events scopes'
    },
    {
      key: 'frontend_return_url',
      label: 'Frontend OAuth return URL',
      ready: Boolean(frontendAppUrl),
      detail: frontendAppUrl ? 'Configured' : 'Missing BRAIN_DUMP_FRONTEND_ORIGIN'
    },
    {
      key: 'admin_token',
      label: 'Admin endpoints protected',
      ready: adminTokenConfigured,
      detail: adminTokenConfigured ? 'Configured' : 'Missing BRAIN_DUMP_ADMIN_TOKEN'
    },
    {
      key: 'durable_storage',
      label: 'Durable backend storage',
      ready: storageMode === 'durable',
      detail: storageMode === 'durable' ? 'Durable storage injected' : 'Using memory storage; do not invite real beta users'
    }
  ];

  return {
    generatedAt,
    ready: checks.every((check) => check.ready),
    checks
  };
}
