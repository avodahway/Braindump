#!/usr/bin/env node

const frontendOrigin = normalizeOrigin(process.env.BRAIN_DUMP_FRONTEND_ORIGIN);
const publicApiOrigin = normalizeOrigin(process.env.BRAIN_DUMP_PUBLIC_API_ORIGIN);
const adminToken = process.env.BRAIN_DUMP_ADMIN_TOKEN?.trim();

const frontendRoutes = ['/', '/privacy', '/terms', '/support', '/data-deletion', '/feedback', '/beta', '/app'];

if (!frontendOrigin || !publicApiOrigin) {
  console.error('Set BRAIN_DUMP_FRONTEND_ORIGIN and BRAIN_DUMP_PUBLIC_API_ORIGIN before running deployment verification.');
  process.exit(1);
}

const checks = [];

for (const route of frontendRoutes) {
  checks.push({
    label: `Frontend ${route}`,
    run: () => expectOk(`${frontendOrigin}${route}`, { expectHtml: true })
  });
}

checks.push({
  label: 'Backend /api/health',
  run: async () => {
    const response = await fetch(`${publicApiOrigin}/api/health`);
    const body = await response.json();
    if (!response.ok || body.ok !== true || body.service !== 'brain-dump-public-backend') {
      throw new Error(`Unexpected health response: ${response.status} ${JSON.stringify(body)}`);
    }
  }
});

checks.push({
  label: 'Admin readiness rejects anonymous requests',
  run: async () => {
    const response = await fetch(`${publicApiOrigin}/api/admin/readiness`);
    if (response.status !== 401) {
      throw new Error(`Expected 401 without admin token, got ${response.status}`);
    }
  }
});

if (adminToken) {
  checks.push({
    label: 'Admin readiness accepts configured token',
    run: async () => {
      const response = await fetch(`${publicApiOrigin}/api/admin/readiness`, {
        headers: { 'X-Brain-Dump-Admin-Token': adminToken }
      });
      const body = await response.json();
      if (!response.ok || typeof body.ready !== 'boolean' || !Array.isArray(body.checks)) {
        throw new Error(`Unexpected readiness response: ${response.status} ${JSON.stringify(body)}`);
      }
    }
  });
}

let failed = 0;

for (const check of checks) {
  try {
    await check.run();
    console.log(`PASS ${check.label}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${check.label}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

if (failed > 0) {
  console.error(`${failed} deployment check${failed === 1 ? '' : 's'} failed.`);
  process.exit(1);
}

console.log('Deployment checks passed.');

function normalizeOrigin(value) {
  return value?.trim().replace(/\/+$/, '');
}

async function expectOk(url, { expectHtml = false } = {}) {
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    throw new Error(`Expected 2xx from ${url}, got ${response.status}`);
  }
  if (expectHtml && !contentType.includes('text/html')) {
    throw new Error(`Expected HTML from ${url}, got ${contentType || 'no content type'}`);
  }
}
