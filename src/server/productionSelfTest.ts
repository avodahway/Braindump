import type { ProductionSelfTest } from '../api/publicContract';
import type { ReadinessReport } from './readinessReport';

export function buildProductionSelfTest({
  generatedAt = new Date().toISOString(),
  readiness,
  frontendAppUrl,
  storageMode,
  storageEncrypted,
  betaAccessConfigured,
  maxJsonBodyBytes,
  rateLimitMaxRequests
}: {
  generatedAt?: string;
  readiness: ReadinessReport;
  frontendAppUrl?: string;
  storageMode: 'memory' | 'durable';
  storageEncrypted: boolean;
  betaAccessConfigured: boolean;
  maxJsonBodyBytes: number;
  rateLimitMaxRequests?: number;
}): ProductionSelfTest {
  const checks: ProductionSelfTest['checks'] = [
    ...readiness.checks.map((check) => ({
      key: `readiness_${check.key}`,
      label: check.label,
      ok: check.ready,
      detail: check.detail
    })),
    {
      key: 'frontend_origin',
      label: 'Frontend origin',
      ok: Boolean(frontendAppUrl?.startsWith('https://')),
      detail: frontendAppUrl ? 'Configured with HTTPS' : 'Missing frontend origin'
    },
    {
      key: 'storage_mode',
      label: 'Storage mode',
      ok: storageMode === 'durable' && storageEncrypted,
      detail: storageMode === 'durable' && storageEncrypted ? 'Durable encrypted storage' : 'Not ready for real users'
    },
    {
      key: 'beta_access_gate',
      label: 'Beta access gate',
      ok: betaAccessConfigured,
      detail: betaAccessConfigured ? 'Invite code configured' : 'No beta access code configured'
    },
    {
      key: 'json_body_limit',
      label: 'JSON body limit',
      ok: maxJsonBodyBytes > 0 && maxJsonBodyBytes <= 262144,
      detail: `${maxJsonBodyBytes} bytes`
    },
    {
      key: 'rate_limit',
      label: 'Rate limit',
      ok: typeof rateLimitMaxRequests === 'number' && rateLimitMaxRequests > 0 && rateLimitMaxRequests <= 120,
      detail: typeof rateLimitMaxRequests === 'number' ? `${rateLimitMaxRequests} requests per window` : 'Rate limiting disabled'
    }
  ];

  return {
    generatedAt,
    ok: checks.every((check) => check.ok),
    checks
  };
}
