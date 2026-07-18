import { describe, expect, it } from 'vitest';
import record from '../../docs/LAUNCH_DECISION_RECORD.md?raw';

describe('launch decision record', () => {
  it('captures go/no-go evidence and follow-up requirements', () => {
    expect(record).toContain('Decision: Go / No-go / Hold');
    expect(record).toContain('pnpm verify:deployment');
    expect(record).toContain('/api/admin/readiness');
    expect(record).toContain('Support and data deletion request review');
    expect(record).toContain('Update `/status` copy');
  });
});
