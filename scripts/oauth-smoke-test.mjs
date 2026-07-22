#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

export async function runOAuthSmokeTest({
  publicApiOrigin,
  betaAccessCode,
  fetchImpl = fetch,
  logger = console
}) {
  const origin = normalizeOrigin(publicApiOrigin);
  if (!origin) throw new Error('Set BRAIN_DUMP_PUBLIC_API_ORIGIN before running the OAuth smoke test.');

  const cookieJar = new Map();
  const checks = [
    {
      label: 'Backend health',
      run: async () => {
        const body = await readJson(await fetchImpl(`${origin}/api/health`));
        if (body.ok !== true || body.service !== 'brain-dump-public-backend') {
          throw new Error(`Unexpected health response: ${JSON.stringify(body)}`);
        }
      }
    },
    {
      label: 'Anonymous workspace',
      run: async () => {
        const body = await readJson(await fetchImpl(`${origin}/api/workspace`, { credentials: 'include' }));
        if (body.status !== 'not_connected') {
          throw new Error(`Expected not_connected workspace, got ${JSON.stringify(body)}`);
        }
      }
    },
    {
      label: 'Beta access',
      run: async () => {
        const status = await readJson(await fetchImpl(`${origin}/api/beta/status`, { credentials: 'include' }));
        if (!status.required) return;
        if (!betaAccessCode) throw new Error('Backend requires beta access; set BRAIN_DUMP_BETA_ACCESS_CODE for smoke testing.');
        const response = await fetchImpl(`${origin}/api/beta/access`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: betaAccessCode })
        });
        rememberCookies(cookieJar, response);
        const body = await readJson(response);
        if (body.access?.granted !== true) throw new Error(`Beta access was not granted: ${JSON.stringify(body)}`);
      }
    },
    {
      label: 'Google OAuth start',
      run: async () => {
        const response = await fetchImpl(`${origin}/api/auth/google/start`, {
          method: 'POST',
          credentials: 'include',
          headers: cookieHeader(cookieJar)
        });
        rememberCookies(cookieJar, response);
        const body = await readJson(response);
        const authorizationUrl = new URL(body.authorizationUrl);
        if (authorizationUrl.origin !== 'https://accounts.google.com') {
          throw new Error(`Unexpected OAuth origin: ${authorizationUrl.origin}`);
        }
        for (const key of ['client_id', 'redirect_uri', 'scope', 'state']) {
          if (!authorizationUrl.searchParams.get(key)) throw new Error(`OAuth URL is missing ${key}.`);
        }
      }
    }
  ];

  let failed = 0;
  for (const check of checks) {
    try {
      await check.run();
      logger.log(`PASS ${check.label}`);
    } catch (error) {
      failed += 1;
      logger.error(`FAIL ${check.label}`);
      logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  if (failed > 0) {
    logger.error(`${failed} OAuth smoke check${failed === 1 ? '' : 's'} failed.`);
    return false;
  }

  logger.log('OAuth smoke test passed.');
  return true;
}

export function normalizeOrigin(value) {
  return value?.trim().replace(/\/+$/, '');
}

function rememberCookies(cookieJar, response) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return;
  for (const cookie of setCookie.split(/,(?=\s*[^;,]+=)/)) {
    const [pair] = cookie.trim().split(';');
    const [name, value] = pair.split('=');
    if (name && value) cookieJar.set(name, value);
  }
}

function cookieHeader(cookieJar) {
  const cookie = [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  return cookie ? { Cookie: cookie } : {};
}

async function readJson(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || `Request failed with ${response.status}`);
  return body;
}

async function main() {
  const ok = await runOAuthSmokeTest({
    publicApiOrigin: process.env.BRAIN_DUMP_PUBLIC_API_ORIGIN,
    betaAccessCode: process.env.BRAIN_DUMP_BETA_ACCESS_CODE
  });
  process.exit(ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
