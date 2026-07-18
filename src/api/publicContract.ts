import type { BrainDumpRequest, BrainDumpResponse, UserWorkspace } from '../lib/types';

export type BetaRequestInput = {
  name: string;
  email: string;
  tools: string;
  googleComfort: string;
  notes?: string;
};

export type BetaRequestRecord = BetaRequestInput & {
  id: string;
  status: 'new';
  createdAt: string;
};

export type FeedbackInput = {
  email?: string;
  requestId?: string;
  lookedRight: string;
  confusing: string;
  expected: string;
};

export type FeedbackRecord = FeedbackInput & {
  id: string;
  status: 'new';
  createdAt: string;
};

export type PublicBackendContract = {
  getWorkspace(): Promise<UserWorkspace>;
  getBetaAccessStatus(): Promise<BetaAccessStatus>;
  redeemBetaAccessCode(code: string): Promise<{ ok: true; access: BetaAccessStatus }>;
  submitBetaRequest(request: BetaRequestInput): Promise<{ ok: true; request: BetaRequestRecord }>;
  submitFeedback(feedback: FeedbackInput): Promise<{ ok: true; feedback: FeedbackRecord }>;
  startGoogleConnection(): Promise<{ authorizationUrl: string }>;
  disconnectGoogle(): Promise<{ ok: true }>;
  deleteAccountData(): Promise<{ ok: true; deleted: string[] }>;
  processBrainDump(request: BrainDumpRequest): Promise<BrainDumpResponse>;
};

export type BetaAccessStatus = {
  required: boolean;
  granted: boolean;
};

export const publicBackendRoutes = {
  health: '/api/health',
  betaStatus: '/api/beta/status',
  betaAccess: '/api/beta/access',
  betaRequest: '/api/beta/request',
  workspace: '/api/workspace',
  googleConnect: '/api/auth/google/start',
  googleCallback: '/api/auth/google/callback',
  googleDisconnect: '/api/auth/google/disconnect',
  accountDelete: '/api/account/delete',
  events: '/api/events',
  feedback: '/api/feedback',
  adminMetrics: '/api/admin/metrics',
  adminBackupPlan: '/api/admin/backup-plan',
  adminReadiness: '/api/admin/readiness',
  adminExecutionErrors: '/api/admin/execution-errors',
  adminBetaRequests: '/api/admin/beta-requests',
  adminFeedback: '/api/admin/feedback',
  brainDump: '/api/brain-dump'
} as const;
