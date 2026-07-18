#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

const frontendRoutes = ['/', '/privacy', '/terms', '/support', '/data-deletion', '/feedback', '/beta', '/status', '/faq', '/operator', '/app'];

const adminRoutes = [
  { label: 'Admin metrics', path: '/api/admin/metrics', kind: 'json' },
  { label: 'Admin backup plan', path: '/api/admin/backup-plan', kind: 'json' },
  { label: 'Admin readiness', path: '/api/admin/readiness', kind: 'readiness' },
  { label: 'Admin execution errors', path: '/api/admin/execution-errors', kind: 'json' },
  { label: 'Admin execution errors CSV', path: '/api/admin/execution-errors?format=csv', kind: 'csv' },
  { label: 'Admin beta requests', path: '/api/admin/beta-requests', kind: 'json' },
  { label: 'Admin beta requests CSV', path: '/api/admin/beta-requests?format=csv', kind: 'csv' },
  { label: 'Admin feedback', path: '/api/admin/feedback', kind: 'json' },
  { label: 'Admin feedback CSV', path: '/api/admin/feedback?format=csv', kind: 'csv' },
  { label: 'Admin support requests', path: '/api/admin/support-requests', kind: 'json' },
  { label: 'Admin support requests CSV', path: '/api/admin/support-requests?format=csv', kind: 'csv' }
];

export function buildDeploymentChecks({
  frontendOrigin,
  publicApiOrigin,
  adminToken,
  fetchImpl = fetch
}) {
  const checks = [];

  for (const route of frontendRoutes) {
    checks.push({
      label: `Frontend ${route}`,
      run: () => expectOk(fetchImpl, `${frontendOrigin}${route}`, { expectHtml: true })
    });
  }

  checks.push({
    label: 'Backend /api/health',
    run: async () => {
      const response = await fetchImpl(`${publicApiOrigin}/api/health`);
      const body = await response.json();
      if (!response.ok || body.ok !== true || body.service !== 'brain-dump-public-backend') {
        throw new Error(`Unexpected health response: ${response.status} ${JSON.stringify(body)}`);
      }
    }
  });

  for (const route of adminRoutes) {
    checks.push({
      label: `${route.label} rejects anonymous requests`,
      run: async () => {
        const response = await fetchImpl(`${publicApiOrigin}${route.path}`);
        if (response.status !== 401 && response.status !== 404) {
          throw new Error(`Expected 401 or 404 without admin token, got ${response.status}`);
        }
      }
    });
  }

  if (adminToken) {
    for (const route of adminRoutes) {
      checks.push({
        label: `${route.label} accepts configured token`,
        run: () => expectAdminResponse(fetchImpl, `${publicApiOrigin}${route.path}`, adminToken, route.kind)
      });
    }
  }

  return checks;
}

export async function runDeploymentChecks(checks, logger = console) {
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
    logger.error(`${failed} deployment check${failed === 1 ? '' : 's'} failed.`);
    return false;
  }

  logger.log('Deployment checks passed.');
  return true;
}

export function normalizeOrigin(value) {
  return value?.trim().replace(/\/+$/, '');
}

async function expectOk(fetchImpl, url, { expectHtml = false } = {}) {
  const response = await fetchImpl(url);
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    throw new Error(`Expected 2xx from ${url}, got ${response.status}`);
  }
  if (expectHtml && !contentType.includes('text/html')) {
    throw new Error(`Expected HTML from ${url}, got ${contentType || 'no content type'}`);
  }
}

async function expectAdminResponse(fetchImpl, url, adminToken, kind) {
  const response = await fetchImpl(url, {
    headers: { 'X-Brain-Dump-Admin-Token': adminToken }
  });

  if (!response.ok) {
    throw new Error(`Expected 2xx from ${url}, got ${response.status}`);
  }

  if (kind === 'csv') {
    const contentType = response.headers.get('content-type') ?? '';
    const body = await response.text();
    if (!contentType.includes('text/csv') || !body.includes(',')) {
      throw new Error(`Unexpected CSV response from ${url}: ${contentType || 'no content type'}`);
    }
    return;
  }

  const body = await response.json();
  if (kind === 'readiness') {
    if (typeof body.ready !== 'boolean' || !Array.isArray(body.checks)) {
      throw new Error(`Unexpected readiness response: ${response.status} ${JSON.stringify(body)}`);
    }
    return;
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(`Unexpected JSON response: ${response.status} ${JSON.stringify(body)}`);
  }
}

async function main() {
  const frontendOrigin = normalizeOrigin(process.env.BRAIN_DUMP_FRONTEND_ORIGIN);
  const publicApiOrigin = normalizeOrigin(process.env.BRAIN_DUMP_PUBLIC_API_ORIGIN);
  const adminToken = process.env.BRAIN_DUMP_ADMIN_TOKEN?.trim();

  if (!frontendOrigin || !publicApiOrigin) {
    console.error('Set BRAIN_DUMP_FRONTEND_ORIGIN and BRAIN_DUMP_PUBLIC_API_ORIGIN before running deployment verification.');
    process.exit(1);
  }

  const ok = await runDeploymentChecks(buildDeploymentChecks({ frontendOrigin, publicApiOrigin, adminToken }));
  process.exit(ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
