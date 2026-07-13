import { describe, expect, it } from 'vitest';
import packet from '../../docs/FIRST_USER_BETA_PACKET.md?raw';

describe('first-user beta packet', () => {
  it('includes the core launch materials for first testers', () => {
    expect(packet).toContain('## Invitation Email');
    expect(packet).toContain('## Tester Instructions');
    expect(packet).toContain('## Live Session Script');
    expect(packet).toContain('## Feedback Questions');
    expect(packet).toContain('[BETA_APP_URL]');
    expect(packet).toContain('Disconnect Google');
  });
});
