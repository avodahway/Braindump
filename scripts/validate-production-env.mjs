#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

export const requiredEnv = [
  'VITE_SUPPORT_EMAIL',
  'VITE_PUBLIC_API_BASE_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'BRAIN_DUMP_PUBLIC_API_ORIGIN',
  'BRAIN_DUMP_FRONTEND_ORIGIN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_KV_TABLE',
  'BRAIN_DUMP_STORAGE_SECRET',
  'GOOGLE_OAUTH_SCOPES',
  'BRAIN_DUMP_STORAGE_PREFIX',
  'BRAIN_DUMP_ADMIN_TOKEN',
  'BRAIN_DUMP_BETA_ACCESS_CODE'
];

const placeholderPattern = /^(replace-|https:\/\/replace-|changeme|todo|example)/i;

export function validateProductionEnv(env = process.env) {
  const missing = [];
  const placeholders = [];

  for (const key of requiredEnv) {
    const value = env[key]?.trim();
    if (!value) {
      missing.push(key);
    } else if (placeholderPattern.test(value)) {
      placeholders.push(key);
    }
  }

  return {
    ok: missing.length === 0 && placeholders.length === 0,
    missing,
    placeholders
  };
}

export function formatValidationResult(result) {
  if (result.ok) return 'Production environment looks ready.';
  const lines = ['Production environment is not ready.'];
  if (result.missing.length) lines.push(`Missing: ${result.missing.join(', ')}`);
  if (result.placeholders.length) lines.push(`Placeholder values: ${result.placeholders.join(', ')}`);
  return lines.join('\n');
}

async function main() {
  const result = validateProductionEnv(process.env);
  const message = formatValidationResult(result);
  if (result.ok) {
    console.log(message);
    return;
  }
  console.error(message);
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
