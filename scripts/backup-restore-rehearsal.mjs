#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

const requiredSections = ['OAuth tokens', 'User workspaces', 'Idempotency responses', 'Execution logs'];

export async function runBackupRestoreRehearsal({
  publicApiOrigin,
  adminToken,
  fetchImpl = fetch,
  logger = console
}) {
  const origin = normalizeOrigin(publicApiOrigin);
  const token = adminToken?.trim();
  if (!origin) throw new Error('Set BRAIN_DUMP_PUBLIC_API_ORIGIN before running the backup restore rehearsal.');
  if (!token) throw new Error('Set BRAIN_DUMP_ADMIN_TOKEN before running the backup restore rehearsal.');

  const response = await fetchImpl(`${origin}/api/admin/backup-plan`, {
    headers: { 'X-Brain-Dump-Admin-Token': token }
  });
  const plan = await readJson(response);
  const result = validateBackupPlan(plan);

  logger.log(`# Brain Dump Backup Restore Rehearsal`);
  logger.log(`Generated: ${new Date().toISOString()}`);
  logger.log(`Storage prefix: ${plan.storagePrefix ?? 'unknown'}`);
  for (const section of plan.sections ?? []) {
    logger.log(`- ${section.name}: ${section.backupAction} Restore: ${section.restoreAction}`);
  }
  for (const item of plan.operatorChecklist ?? []) {
    logger.log(`CHECK ${item}`);
  }

  if (!result.ok) {
    for (const issue of result.issues) logger.error(`FAIL ${issue}`);
    return false;
  }

  logger.log('Backup restore rehearsal checklist is complete.');
  return true;
}

export function validateBackupPlan(plan) {
  const issues = [];
  if (!plan || typeof plan !== 'object') issues.push('Backup plan response must be an object.');
  const sections = Array.isArray(plan?.sections) ? plan.sections : [];
  const names = new Set(sections.map((section) => section?.name).filter(Boolean));
  for (const required of requiredSections) {
    if (!names.has(required)) issues.push(`Missing backup section: ${required}`);
  }
  if (!Array.isArray(plan?.operatorChecklist) || plan.operatorChecklist.length < 3) {
    issues.push('Operator checklist must contain restore rehearsal steps.');
  }
  if (sections.some((section) => section?.sensitivity === 'secret' && !String(section.backupAction).includes('Do not export'))) {
    issues.push('Secret backup sections must explicitly prohibit local token exports.');
  }

  return {
    ok: issues.length === 0,
    issues
  };
}

export function normalizeOrigin(value) {
  return value?.trim().replace(/\/+$/, '');
}

async function readJson(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || `Request failed with ${response.status}`);
  return body;
}

async function main() {
  const ok = await runBackupRestoreRehearsal({
    publicApiOrigin: process.env.BRAIN_DUMP_PUBLIC_API_ORIGIN,
    adminToken: process.env.BRAIN_DUMP_ADMIN_TOKEN
  });
  process.exit(ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
