import { describe, expect, it } from 'vitest';
import { collectAnalyticsPrivacyViolationsFromSources } from './audit-analytics-privacy.mjs';

describe('analytics privacy audit', () => {
  it('accepts the current bounded analytics payload fields', () => {
    const violations = collectAnalyticsPrivacyViolationsFromSources([
      {
        file: 'src/lib/types.ts',
        text: `export type AnalyticsEvent = {
  name: AnalyticsEventName;
  requestId?: string;
  mode?: string;
  actionCount?: number;
};`
      },
      {
        file: 'src/App.tsx',
        text: `trackEvent({ name: 'create_completed', requestId: 'req-1', actionCount: 2 });`
      }
    ]);

    expect(violations).toEqual([]);
  });

  it('rejects private fields on analytics event types and direct calls', () => {
    const violations = collectAnalyticsPrivacyViolationsFromSources([
      {
        file: 'src/lib/types.ts',
        text: `export type AnalyticsEvent = {
  name: AnalyticsEventName;
  email?: string;
  sourceText?: string;
};`
      },
      {
        file: 'src/App.tsx',
        text: `trackEvent({
  name: 'review_created',
  text: draft,
  token: accessToken
});`
      }
    ]);

    expect(violations.map((violation) => `${violation.file}:${violation.key}`)).toEqual([
      'src/lib/types.ts:email',
      'src/lib/types.ts:sourceText',
      'src/App.tsx:text',
      'src/App.tsx:token'
    ]);
  });
});
