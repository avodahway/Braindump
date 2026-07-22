import { describe, expect, it } from 'vitest';
import checklist from '../../docs/LAUNCH_ASSET_CHECKLIST.md?raw';

describe('launch asset checklist', () => {
  it('covers screenshots, demo clips, brand assets, and privacy boundaries', () => {
    expect(checklist).toContain('Required Screenshots');
    expect(checklist).toContain('OAuth verification recording');
    expect(checklist).toContain('brain-dump-icon-512.png');
    expect(checklist).toContain('Do Not Capture');
    expect(checklist).toContain('OAuth tokens');
    expect(checklist).toContain('brain-dump-oauth-verification-demo.mp4');
  });
});
