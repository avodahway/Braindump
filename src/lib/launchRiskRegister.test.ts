import { describe, expect, it } from 'vitest';
import register from '../../docs/LAUNCH_RISK_REGISTER.md?raw';

describe('launch risk register', () => {
  it('tracks critical public launch risks and no-go rules', () => {
    expect(register).toContain('OAuth verification delay');
    expect(register).toContain('Duplicate Google writes');
    expect(register).toContain('Disconnect or deletion failure');
    expect(register).toContain('Unencrypted durable storage');
    expect(register).toContain('No real user OAuth tokens without encryption');
    expect(register).toContain('Pause new invites immediately');
  });
});
