import { describe, expect, it } from 'vitest';
import worksheet from '../../docs/DEPLOYMENT_SMOKE_TEST.md?raw';

describe('deployment smoke test worksheet', () => {
  it('covers public, app, operator, and blocker checks', () => {
    expect(worksheet).toContain('pnpm verify:deployment');
    expect(worksheet).toContain('Load a first-run sample');
    expect(worksheet).toContain('Export execution errors CSV');
    expect(worksheet).toContain('Mark one support request');
    expect(worksheet).toContain('Blockers');
  });
});
