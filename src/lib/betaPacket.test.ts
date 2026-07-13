import { describe, expect, it } from 'vitest';
import packet from '../../docs/FIRST_USER_BETA_PACKET.md?raw';
import worksheet from '../../docs/BETA_LAUNCH_WORKSHEET.md?raw';

describe('first-user beta packet', () => {
  it('includes the core launch materials for first testers', () => {
    expect(packet).toContain('## Invitation Email');
    expect(packet).toContain('## Tester Instructions');
    expect(packet).toContain('## Live Session Script');
    expect(packet).toContain('## Feedback Questions');
    expect(packet).toContain('[BETA_APP_URL]');
    expect(packet).toContain('Disconnect Google');
  });

  it('includes deployment placeholders and launch-day checks', () => {
    expect(worksheet).toContain('## Deployment Placeholders');
    expect(worksheet).toContain('[BETA_APP_URL]');
    expect(worksheet).toContain('## OAuth Test Users');
    expect(worksheet).toContain('## Admin Token Checks');
    expect(worksheet).toContain('pnpm test');
    expect(worksheet).toContain('pnpm build');
  });
});
