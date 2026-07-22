import type { SupportRequestRecord } from '../api/publicContract';

export type SupportSlaReport = {
  generatedAt: string;
  ok: boolean;
  thresholdHours: number;
  openCount: number;
  overdueCount: number;
  oldestOpenHours?: number;
  overdueRequests: Array<{
    id: string;
    email: string;
    issueType: string;
    summary: string;
    status: SupportRequestRecord['status'];
    ageHours: number;
    createdAt: string;
  }>;
};

export function buildSupportSlaReport({
  generatedAt = new Date().toISOString(),
  requests,
  thresholdHours = 24
}: {
  generatedAt?: string;
  requests: SupportRequestRecord[];
  thresholdHours?: number;
}): SupportSlaReport {
  const generatedTime = new Date(generatedAt).getTime();
  const openRequests = requests.filter((request) => request.status === 'new' || request.status === 'in_progress');
  const withAge = openRequests.map((request) => ({
    request,
    ageHours: Math.max(0, Math.floor((generatedTime - new Date(request.createdAt).getTime()) / 36e5))
  }));
  const overdue = withAge
    .filter((item) => item.ageHours >= thresholdHours)
    .sort((left, right) => right.ageHours - left.ageHours);

  return {
    generatedAt,
    ok: overdue.length === 0,
    thresholdHours,
    openCount: openRequests.length,
    overdueCount: overdue.length,
    oldestOpenHours: withAge.length ? Math.max(...withAge.map((item) => item.ageHours)) : undefined,
    overdueRequests: overdue.map(({ request, ageHours }) => ({
      id: request.id,
      email: request.email,
      issueType: request.issueType,
      summary: request.summary,
      status: request.status,
      ageHours,
      createdAt: request.createdAt
    }))
  };
}
