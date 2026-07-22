import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';

describe('public metadata', () => {
  it('includes launch-ready description, canonical, and social share tags', () => {
    expect(indexHtml).toContain('name="description"');
    expect(indexHtml).toContain('reviewed Google Tasks, Calendar events, projects, and follow-ups');
    expect(indexHtml).toContain('property="og:title" content="Brain Dump"');
    expect(indexHtml).toContain('property="og:image" content="/icons/brain-dump-icon-512.png"');
    expect(indexHtml).toContain('name="twitter:card" content="summary"');
    expect(indexHtml).toContain('rel="canonical" href="/"');
  });
});
