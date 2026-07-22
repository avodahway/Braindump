import { describe, expect, it } from 'vitest';
import guide from '../../docs/OPERATOR_PRIVACY_GUIDE.md?raw';

describe('operator privacy guide', () => {
  it('documents safe handling of sensitive launch records', () => {
    expect(guide).toContain('Do not ask for Google passwords');
    expect(guide).toContain('Keep exported CSVs local to the launch workflow');
    expect(guide).toContain('data deletion requests');
    expect(guide).toContain('Pause and review manually');
  });
});
