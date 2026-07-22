import type { ExecutionLogRecord } from './executionLogStore';

export type DuplicateWriteAudit = {
  generatedAt: string;
  ok: boolean;
  totalCreated: number;
  duplicateGroups: DuplicateWriteGroup[];
};

export type DuplicateWriteGroup = {
  key: string;
  userId?: string;
  actionType: string;
  title: string;
  count: number;
  requestIds: string[];
  providerIds: string[];
  latestCreatedAt: string;
};

export function buildDuplicateWriteAudit({
  generatedAt = new Date().toISOString(),
  records
}: {
  generatedAt?: string;
  records: ExecutionLogRecord[];
}): DuplicateWriteAudit {
  const created = records.filter((record) => record.status === 'created');
  const groups = new Map<string, ExecutionLogRecord[]>();

  for (const record of created) {
    const key = duplicateKey(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  const duplicateGroups = [...groups.entries()]
    .map(([key, groupRecords]) => toDuplicateGroup(key, groupRecords))
    .filter((group) => group.count > 1 && group.requestIds.length > 1)
    .sort((left, right) => right.latestCreatedAt.localeCompare(left.latestCreatedAt));

  return {
    generatedAt,
    ok: duplicateGroups.length === 0,
    totalCreated: created.length,
    duplicateGroups
  };
}

function duplicateKey(record: ExecutionLogRecord): string {
  return [record.userId?.toLowerCase() ?? 'unknown', record.actionType, normalizedTitle(record.title)].join('|');
}

function normalizedTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toDuplicateGroup(key: string, records: ExecutionLogRecord[]): DuplicateWriteGroup {
  const [userId, actionType, title] = key.split('|');
  const requestIds = unique(records.map((record) => record.requestId));
  const providerIds = unique(records.map((record) => record.providerId).filter((value): value is string => Boolean(value)));
  const latestCreatedAt = records.map((record) => record.createdAt).sort().at(-1) ?? '';

  return {
    key,
    userId: userId === 'unknown' ? undefined : userId,
    actionType,
    title,
    count: records.length,
    requestIds,
    providerIds,
    latestCreatedAt
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
