import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config.ts?raw';

describe('PWA routing', () => {
  it('does not serve the app shell for API navigations', () => {
    expect(viteConfig).toContain('navigateFallbackDenylist');
    expect(viteConfig).toContain('/^\\/api\\//');
  });
});
