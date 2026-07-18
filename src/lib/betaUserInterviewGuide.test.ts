import { describe, expect, it } from 'vitest';
import guide from '../../docs/BETA_USER_INTERVIEW_GUIDE.md?raw';

describe('beta user interview guide', () => {
  it('structures watched first-run feedback without asking for secrets', () => {
    expect(guide).toContain('watched first runs');
    expect(guide).toContain('Whether the review step is clear');
    expect(guide).toContain('What would make this worth paying for later?');
    expect(guide).toContain('Do not ask for Google passwords, OAuth tokens, or private screenshots');
    expect(guide).toContain('Mark feedback status in `/operator`');
  });
});
