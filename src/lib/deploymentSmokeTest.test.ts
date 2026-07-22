import { describe, expect, it } from 'vitest';
import worksheet from '../../docs/DEPLOYMENT_SMOKE_TEST.md?raw';

describe('deployment smoke test worksheet', () => {
  it('covers public, app, operator, and blocker checks', () => {
    expect(worksheet).toContain('pnpm verify:deployment');
    expect(worksheet).toContain('Load a first-run sample');
    expect(worksheet).toContain('`/roadmap`');
    expect(worksheet).toContain('`/press`');
    expect(worksheet).toContain('`/pricing`');
    expect(worksheet).toContain('`/demo`');
    expect(worksheet).toContain('/robots.txt');
    expect(worksheet).toContain('Export launch notes Markdown');
    expect(worksheet).toContain('Filter beta requests by status');
    expect(worksheet).toContain('Filter feedback and support requests by status');
    expect(worksheet).toContain('Export execution errors CSV');
    expect(worksheet).toContain('Mark one support request');
    expect(worksheet).toContain('Blockers');
  });
});
