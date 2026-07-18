import { describe, expect, it, vi } from 'vitest';
import { buildDeploymentChecks, normalizeOrigin, runDeploymentChecks } from './verify-deployment.mjs';

describe('deployment verifier', () => {
  it('normalizes configured origins', () => {
    expect(normalizeOrigin(' https://braindump.app/// ')).toBe('https://braindump.app');
    expect(normalizeOrigin(undefined)).toBeUndefined();
  });

  it('builds public, anonymous-admin, and tokened admin checks', () => {
    const checks = buildDeploymentChecks({
      frontendOrigin: 'https://braindump.app',
      publicApiOrigin: 'https://api.braindump.app',
      adminToken: 'admin-token',
      fetchImpl: vi.fn()
    });

    expect(checks.map((check) => check.label)).toEqual([
      'Frontend /',
      'Frontend /privacy',
      'Frontend /terms',
      'Frontend /support',
      'Frontend /data-deletion',
      'Frontend /feedback',
      'Frontend /beta',
      'Frontend /status',
      'Frontend /faq',
      'Frontend /security',
      'Frontend /install',
      'Frontend /roadmap',
      'Frontend /press',
      'Frontend /examples',
      'Frontend /pricing',
      'Frontend /operator',
      'Frontend /app',
      'Frontend metadata',
      'Frontend robots',
      'Frontend sitemap',
      'Backend /api/health',
      'Admin metrics rejects anonymous requests',
      'Admin backup plan rejects anonymous requests',
      'Admin readiness rejects anonymous requests',
      'Admin launch summary rejects anonymous requests',
      'Admin execution errors rejects anonymous requests',
      'Admin execution errors CSV rejects anonymous requests',
      'Admin beta requests rejects anonymous requests',
      'Admin beta requests CSV rejects anonymous requests',
      'Admin feedback rejects anonymous requests',
      'Admin feedback CSV rejects anonymous requests',
      'Admin support requests rejects anonymous requests',
      'Admin support requests CSV rejects anonymous requests',
      'Admin metrics accepts configured token',
      'Admin backup plan accepts configured token',
      'Admin readiness accepts configured token',
      'Admin launch summary accepts configured token',
      'Admin execution errors accepts configured token',
      'Admin execution errors CSV accepts configured token',
      'Admin beta requests accepts configured token',
      'Admin beta requests CSV accepts configured token',
      'Admin feedback accepts configured token',
      'Admin feedback CSV accepts configured token',
      'Admin support requests accepts configured token',
      'Admin support requests CSV accepts configured token'
    ]);
  });

  it('accepts 401 or 404 for anonymous admin checks', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('/api/admin/metrics')) return jsonResponse({}, 404);
      return htmlResponse();
    });
    const checks = buildDeploymentChecks({
      frontendOrigin: 'https://braindump.app',
      publicApiOrigin: 'https://api.braindump.app',
      fetchImpl
    });

    await expect(checks.find((check) => check.label === 'Admin metrics rejects anonymous requests')?.run()).resolves.toBeUndefined();
  });

  it('checks public metadata and search index files', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith('/robots.txt')) return textResponse('User-agent: *\nDisallow: /operator\nSitemap: https://braindump.app/sitemap.xml');
      if (String(url).endsWith('/sitemap.xml')) return xmlResponse('<urlset><url><loc>https://braindump.app/</loc></url><url><loc>https://braindump.app/roadmap</loc></url><url><loc>https://braindump.app/press</loc></url><url><loc>https://braindump.app/examples</loc></url><url><loc>https://braindump.app/pricing</loc></url></urlset>');
      return htmlResponse('<!doctype html><meta name="description"><meta property="og:title" content="Brain Dump"><meta name="twitter:card" content="summary">');
    });
    const checks = buildDeploymentChecks({
      frontendOrigin: 'https://braindump.app',
      publicApiOrigin: 'https://api.braindump.app',
      fetchImpl
    });

    await checks.find((check) => check.label === 'Frontend metadata')?.run();
    await checks.find((check) => check.label === 'Frontend robots')?.run();
    await checks.find((check) => check.label === 'Frontend sitemap')?.run();

    expect(fetchImpl).toHaveBeenCalledWith('https://braindump.app/robots.txt');
    expect(fetchImpl).toHaveBeenCalledWith('https://braindump.app/sitemap.xml');
  });

  it('runs tokened JSON and CSV admin checks with the admin header', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).endsWith('/api/admin/readiness')) return jsonResponse({ ready: false, checks: [] });
      if (String(url).includes('format=csv')) return csvResponse('createdAt,email\n2026-07-17,user@example.com');
      return jsonResponse({ ok: true, calls: [], requests: [], feedback: [] });
    });
    const checks = buildDeploymentChecks({
      frontendOrigin: 'https://braindump.app',
      publicApiOrigin: 'https://api.braindump.app',
      adminToken: 'admin-token',
      fetchImpl
    });

    await checks.find((check) => check.label === 'Admin readiness accepts configured token')?.run();
    await checks.find((check) => check.label === 'Admin feedback CSV accepts configured token')?.run();
    await checks.find((check) => check.label === 'Admin support requests CSV accepts configured token')?.run();

    expect(fetchImpl).toHaveBeenCalledWith('https://api.braindump.app/api/admin/readiness', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.braindump.app/api/admin/feedback?format=csv', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.braindump.app/api/admin/support-requests?format=csv', {
      headers: { 'X-Brain-Dump-Admin-Token': 'admin-token' }
    });
  });

  it('reports failed checks without throwing', async () => {
    const logger = {
      log: vi.fn(),
      error: vi.fn()
    };

    const ok = await runDeploymentChecks(
      [
        { label: 'Passing check', run: async () => undefined },
        { label: 'Failing check', run: async () => { throw new Error('broken'); } }
      ],
      logger
    );

    expect(ok).toBe(false);
    expect(logger.log).toHaveBeenCalledWith('PASS Passing check');
    expect(logger.error).toHaveBeenCalledWith('FAIL Failing check');
  });
});

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function htmlResponse(value = '<!doctype html>') {
  return new Response(value, {
    headers: { 'Content-Type': 'text/html' }
  });
}

function textResponse(value) {
  return new Response(value, {
    headers: { 'Content-Type': 'text/plain' }
  });
}

function xmlResponse(value) {
  return new Response(value, {
    headers: { 'Content-Type': 'application/xml' }
  });
}

function csvResponse(value) {
  return new Response(value, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8' }
  });
}
