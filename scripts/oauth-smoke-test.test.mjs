import { describe, expect, it, vi } from 'vitest';
import { normalizeOrigin, runOAuthSmokeTest } from './oauth-smoke-test.mjs';

describe('OAuth smoke test', () => {
  it('normalizes API origins', () => {
    expect(normalizeOrigin(' https://api.example.com/// ')).toBe('https://api.example.com');
  });

  it('checks health, anonymous workspace, beta access, and OAuth start', async () => {
    const logger = { log: vi.fn(), error: vi.fn() };
    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).endsWith('/api/health')) {
        return jsonResponse({ ok: true, service: 'brain-dump-public-backend' });
      }
      if (String(url).endsWith('/api/workspace')) {
        return jsonResponse({ status: 'not_connected', destinations: [] });
      }
      if (String(url).endsWith('/api/beta/status')) {
        return jsonResponse({ required: true, granted: false });
      }
      if (String(url).endsWith('/api/beta/access')) {
        expect(init).toMatchObject({
          method: 'POST',
          body: JSON.stringify({ code: 'founder-beta' })
        });
        return jsonResponse({ ok: true, access: { required: true, granted: true } }, 200, {
          'set-cookie': 'bd_beta_access=abc123; Path=/; HttpOnly'
        });
      }
      if (String(url).endsWith('/api/auth/google/start')) {
        expect(init?.headers).toEqual({ Cookie: 'bd_beta_access=abc123' });
        return jsonResponse({
          authorizationUrl:
            'https://accounts.google.com/o/oauth2/v2/auth?client_id=client-id&redirect_uri=https%3A%2F%2Fapi.example.com%2Fapi%2Fauth%2Fgoogle%2Fcallback&scope=openid&state=state-1'
        });
      }
      return jsonResponse({ error: 'not found' }, 404);
    });

    await expect(
      runOAuthSmokeTest({
        publicApiOrigin: 'https://api.example.com/',
        betaAccessCode: 'founder-beta',
        fetchImpl,
        logger
      })
    ).resolves.toBe(true);

    expect(logger.log).toHaveBeenCalledWith('OAuth smoke test passed.');
  });

  it('fails clearly when beta access is required but no code is supplied', async () => {
    const logger = { log: vi.fn(), error: vi.fn() };
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith('/api/health')) return jsonResponse({ ok: true, service: 'brain-dump-public-backend' });
      if (String(url).endsWith('/api/workspace')) return jsonResponse({ status: 'not_connected', destinations: [] });
      if (String(url).endsWith('/api/beta/status')) return jsonResponse({ required: true, granted: false });
      return jsonResponse({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=a&redirect_uri=b&scope=c&state=d' });
    });

    await expect(
      runOAuthSmokeTest({
        publicApiOrigin: 'https://api.example.com',
        fetchImpl,
        logger
      })
    ).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledWith('Backend requires beta access; set BRAIN_DUMP_BETA_ACCESS_CODE for smoke testing.');
  });
});

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers
    }
  });
}
