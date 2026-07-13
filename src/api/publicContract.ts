import type { BrainDumpRequest, BrainDumpResponse, UserWorkspace } from '../lib/types';

export type PublicBackendContract = {
  getWorkspace(): Promise<UserWorkspace>;
  startGoogleConnection(): Promise<{ authorizationUrl: string }>;
  disconnectGoogle(): Promise<{ ok: true }>;
  processBrainDump(request: BrainDumpRequest): Promise<BrainDumpResponse>;
};

export const publicBackendRoutes = {
  health: '/api/health',
  workspace: '/api/workspace',
  googleConnect: '/api/auth/google/start',
  googleCallback: '/api/auth/google/callback',
  googleDisconnect: '/api/auth/google/disconnect',
  events: '/api/events',
  adminMetrics: '/api/admin/metrics',
  adminBackupPlan: '/api/admin/backup-plan',
  adminReadiness: '/api/admin/readiness',
  brainDump: '/api/brain-dump'
} as const;
