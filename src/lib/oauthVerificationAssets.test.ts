import { describe, expect, it } from 'vitest';
import assets from '../../docs/OAUTH_VERIFICATION_ASSETS.md?raw';

describe('OAuth verification assets checklist', () => {
  it('captures URLs, scopes, demo video, and readiness evidence', () => {
    expect(assets).toContain('Production home page');
    expect(assets).toContain('https://www.googleapis.com/auth/tasks');
    expect(assets).toContain('Demo Video Checklist');
    expect(assets).toContain('/api/admin/readiness');
  });
});
