import { describe, expect, it } from 'vitest';
import robots from '../../public/robots.txt?raw';
import sitemap from '../../public/sitemap.xml?raw';

describe('public search index files', () => {
  it('exposes launch pages and keeps operator out of the sitemap', () => {
    expect(robots).toContain('Disallow: /operator');
    expect(robots).toContain('Sitemap: https://braindump.app/sitemap.xml');
    expect(sitemap).toContain('<loc>https://braindump.app/</loc>');
    expect(sitemap).toContain('<loc>https://braindump.app/app</loc>');
    expect(sitemap).toContain('<loc>https://braindump.app/privacy</loc>');
    expect(sitemap).toContain('<loc>https://braindump.app/roadmap</loc>');
    expect(sitemap).not.toContain('/operator');
  });
});
