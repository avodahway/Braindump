import { describe, expect, it } from 'vitest';
import { formatValidationResult, requiredEnv, validateProductionEnv } from './validate-production-env.mjs';

describe('production environment validator', () => {
  it('passes when all required values are present and non-placeholder', () => {
    const env = Object.fromEntries(requiredEnv.map((key) => [key, `real-${key.toLowerCase()}`]));

    expect(validateProductionEnv(env)).toEqual({
      ok: true,
      missing: [],
      placeholders: []
    });
  });

  it('reports missing and placeholder values without printing secrets', () => {
    const result = validateProductionEnv({
      VITE_SUPPORT_EMAIL: 'support@braindump.app',
      GOOGLE_CLIENT_SECRET: 'replace-with-secret',
      BRAIN_DUMP_ADMIN_TOKEN: 'todo'
    });

    expect(result.ok).toBe(false);
    expect(result.missing).toContain('GOOGLE_CLIENT_ID');
    expect(result.placeholders).toEqual(['GOOGLE_CLIENT_SECRET', 'BRAIN_DUMP_ADMIN_TOKEN']);
    expect(formatValidationResult(result)).toContain('Placeholder values: GOOGLE_CLIENT_SECRET, BRAIN_DUMP_ADMIN_TOKEN');
    expect(formatValidationResult(result)).not.toContain('replace-with-secret');
  });
});
