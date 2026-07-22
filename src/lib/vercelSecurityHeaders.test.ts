import { describe, expect, it } from 'vitest';
import config from '../../vercel.json';

describe('Vercel security headers', () => {
  it('sets baseline browser protections for public deployment', () => {
    const headers = Object.fromEntries(config.headers[0].headers.map((header) => [header.key, header.value]));

    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Permissions-Policy']).toContain('microphone=(self)');
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
  });
});
