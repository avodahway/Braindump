import { describe, expect, it } from 'vitest';
import triage from '../../docs/OPERATOR_TRIAGE.md?raw';

describe('operator triage guide', () => {
  it('defines severity, categories, and stop-the-line issues', () => {
    expect(triage).toContain('Critical');
    expect(triage).toContain('OAuth/connect');
    expect(triage).toContain('Stop-The-Line Issues');
    expect(triage).toContain('Users cannot disconnect Google');
  });
});
