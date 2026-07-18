import { describe, expect, it } from 'vitest';
import plan from '../../docs/BETA_COHORT_PLAN.md?raw';

describe('beta cohort plan', () => {
  it('defines cohort sizes, tester fit, and expansion gates', () => {
    expect(plan).toContain('Founder watched run');
    expect(plan).toContain('Small operator cohort');
    expect(plan).toContain('Public beta seed');
    expect(plan).toContain('Use Google Calendar or Google Tasks weekly');
    expect(plan).toContain('Do not expand to the next cohort until');
    expect(plan).toContain('At least one launch-notes export is saved from `/operator`');
  });
});
