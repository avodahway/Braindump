import { describe, expect, it } from 'vitest';
import kit from '../../docs/LAUNCH_ANNOUNCEMENT_KIT.md?raw';

describe('launch announcement kit', () => {
  it('keeps public launch copy inside beta boundaries', () => {
    expect(kit).toContain('Brain Dump turns messy thoughts into reviewed Google Tasks');
    expect(kit).toContain('It does not send email');
    expect(kit).toContain('It does not charge during beta');
    expect(kit).toContain('[BRAIN_DUMP_FRONTEND_ORIGIN]/beta');
    expect(kit).toContain('Export launch notes from `/operator`');
  });
});
