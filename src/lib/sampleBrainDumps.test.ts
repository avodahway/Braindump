import { describe, expect, it } from 'vitest';
import { parseBrainDump } from './parser';
import { sampleBrainDumps } from './sampleBrainDumps';

describe('sample brain dumps', () => {
  it('provide first-run examples that parse into useful actions', () => {
    expect(sampleBrainDumps).toHaveLength(3);

    for (const sample of sampleBrainDumps) {
      const parsed = parseBrainDump(sample.text, `sample-${sample.label}`);
      expect(parsed.actions.length).toBeGreaterThanOrEqual(3);
      expect(parsed.actions.some((action) => action.type === 'calendar')).toBe(true);
      expect(parsed.actions.some((action) => action.type === 'waiting')).toBe(true);
    }
  });
});
