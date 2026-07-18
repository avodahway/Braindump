import { describe, expect, it } from 'vitest';
import changelog from '../../CHANGELOG.md?raw';

describe('changelog', () => {
  it('summarizes the beta foundation release surface', () => {
    expect(changelog).toContain('0.1.0-beta-foundation');
    expect(changelog).toContain('review-before-create');
    expect(changelog).toContain('protected operator dashboard');
    expect(changelog).toContain('launch decision records');
  });
});
