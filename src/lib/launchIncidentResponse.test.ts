import { describe, expect, it } from 'vitest';
import runbook from '../../docs/LAUNCH_INCIDENT_RESPONSE.md?raw';

describe('launch incident response runbook', () => {
  it('keeps critical public-launch incident paths documented', () => {
    expect(runbook).toContain('Stop-The-Line Triggers');
    expect(runbook).toContain('Users cannot disconnect Google');
    expect(runbook).toContain('Duplicate Write Incident');
    expect(runbook).toContain('Data Deletion Or Disconnect Incident');
    expect(runbook).toContain('Support Overload Incident');
    expect(runbook).toContain('Beta cohort readiness recommends a nonzero next cohort size');
  });
});
