import type {
  BetaCohortReadinessReport,
  BetaRequestRecord,
  FeedbackRecord,
  ProductionSelfTest,
  SupportSlaReport
} from '../api/publicContract';
import type { DuplicateWriteAudit } from './duplicateWriteAudit';
import type { ExecutionLogRecord } from './executionLogStore';
import type { ReadinessReport } from './readinessReport';

export function buildBetaCohortReadiness({
  generatedAt = new Date().toISOString(),
  readiness,
  selfTest,
  duplicateWriteAudit,
  supportSla,
  betaRequests,
  feedback,
  recentErrors
}: {
  generatedAt?: string;
  readiness: ReadinessReport;
  selfTest: ProductionSelfTest;
  duplicateWriteAudit: DuplicateWriteAudit;
  supportSla: SupportSlaReport;
  betaRequests: BetaRequestRecord[];
  feedback: FeedbackRecord[];
  recentErrors: ExecutionLogRecord[];
}): BetaCohortReadinessReport {
  const betaNew = countStatus(betaRequests, 'new');
  const betaInvited = countStatus(betaRequests, 'invited');
  const feedbackNew = countStatus(feedback, 'new');
  const supportOpen = supportSla.openCount;
  const executionErrors = recentErrors.length;

  const checks = [
    {
      key: 'production_readiness',
      label: 'Production readiness',
      ok: readiness.ready,
      detail: readiness.ready ? 'All environment and storage gates are ready.' : `${readiness.checks.filter((check) => !check.ready).length} readiness gate needs attention.`
    },
    {
      key: 'production_self_test',
      label: 'Production self-test',
      ok: selfTest.ok,
      detail: selfTest.ok ? 'Runtime self-test is passing.' : `${selfTest.checks.filter((check) => !check.ok).length} self-test check needs attention.`
    },
    {
      key: 'duplicate_writes',
      label: 'Duplicate write audit',
      ok: duplicateWriteAudit.ok,
      detail: duplicateWriteAudit.ok ? 'No duplicate write groups found.' : `${duplicateWriteAudit.duplicateGroups.length} duplicate write group needs investigation.`
    },
    {
      key: 'support_sla',
      label: 'Support SLA',
      ok: supportSla.ok,
      detail: supportSla.ok ? `${supportOpen} open support request${supportOpen === 1 ? '' : 's'} inside SLA.` : `${supportSla.overdueCount} overdue support request${supportSla.overdueCount === 1 ? '' : 's'}.`
    },
    {
      key: 'execution_errors',
      label: 'Recent execution errors',
      ok: executionErrors === 0,
      detail: executionErrors === 0 ? 'No recent execution errors.' : `${executionErrors} recent execution error${executionErrors === 1 ? '' : 's'} need review.`
    },
    {
      key: 'feedback_queue',
      label: 'Feedback queue',
      ok: feedbackNew <= 5,
      detail: `${feedbackNew} unreviewed feedback item${feedbackNew === 1 ? '' : 's'}.`
    }
  ];

  return {
    generatedAt,
    ok: checks.every((check) => check.ok),
    recommendedNextCohortSize: recommendedCohortSize({
      checksOk: checks.every((check) => check.ok),
      betaNew,
      betaInvited,
      supportOpen,
      feedbackNew
    }),
    queueCounts: {
      betaNew,
      betaInvited,
      feedbackNew,
      supportOpen,
      executionErrors
    },
    checks
  };
}

function countStatus<T extends string>(records: Array<{ status: T }>, status: T): number {
  return records.filter((record) => record.status === status).length;
}

function recommendedCohortSize({
  checksOk,
  betaNew,
  betaInvited,
  supportOpen,
  feedbackNew
}: {
  checksOk: boolean;
  betaNew: number;
  betaInvited: number;
  supportOpen: number;
  feedbackNew: number;
}): number {
  if (!checksOk) return 0;
  if (supportOpen > 10 || feedbackNew > 10) return 3;
  if (betaInvited < 10) return Math.min(10, Math.max(3, betaNew));
  return Math.min(25, Math.max(5, betaNew));
}
