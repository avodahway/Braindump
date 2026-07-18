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
  status: BetaRequestStatus;
  createdAt: string;
  updatedAt?: string;
};

export type BetaRequestStatus = 'new' | 'invited' | 'archived';

export type FeedbackInput = {
  email?: string;
  requestId?: string;
  lookedRight: string;
  confusing: string;
  expected: string;
};

export type FeedbackRecord = FeedbackInput & {
  id: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt?: string;
};

export type FeedbackStatus = 'new' | 'reviewed' | 'archived';

export type SupportRequestInput = {
  email: string;
  issueType: string;
  summary: string;
  details: string;
};

export type SupportRequestRecord = SupportRequestInput & {
  id: string;
  status: SupportRequestStatus;
  createdAt: string;
  updatedAt?: string;
};

export type SupportRequestStatus = 'new' | 'in_progress' | 'resolved' | 'archived';

export type LaunchSummary = {
  generatedAt: string;
  ready: boolean;
  totalEvents: number;
  uniqueUsers: number;
  totalErrors: number;
  latestEventAt?: string;
  queueCounts: {
    beta: Record<BetaRequestStatus, number>;
    feedback: Record<FeedbackStatus, number>;
    support: Record<SupportRequestStatus, number>;
    recentExecutionErrors: number;
  };
};

export type PublicBackendContract = {
  getWorkspace(): Promise<UserWorkspace>;
  getBetaAccessStatus(): Promise<BetaAccessStatus>;
  redeemBetaAccessCode(code: string): Promise<{ ok: true; access: BetaAccessStatus }>;
  submitBetaRequest(request: BetaRequestInput): Promise<{ ok: true; request: BetaRequestRecord }>;
  submitFeedback(feedback: FeedbackInput): Promise<{ ok: true; feedback: FeedbackRecord }>;
  submitSupportRequest(request: SupportRequestInput): Promise<{ ok: true; supportRequest: SupportRequestRecord }>;
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
  supportRequest: '/api/support/request',
  adminMetrics: '/api/admin/metrics',
  adminBackupPlan: '/api/admin/backup-plan',
  adminReadiness: '/api/admin/readiness',
  adminLaunchSummary: '/api/admin/launch-summary',
  adminExecutionErrors: '/api/admin/execution-errors',
  adminBetaRequests: '/api/admin/beta-requests',
  adminBetaRequest: '/api/admin/beta-request',
  adminFeedback: '/api/admin/feedback',
  adminFeedbackItem: '/api/admin/feedback-item',
  adminSupportRequests: '/api/admin/support-requests',
  adminSupportRequest: '/api/admin/support-request',
  brainDump: '/api/brain-dump'
} as const;
