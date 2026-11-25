import { describe, expect, it } from 'vitest';
import JsonLd from '../src/components/JsonLd.astro';
import { GET as robots } from '../src/pages/robots.txt';
import { GET as sitemap } from '../src/pages/sitemap.xml';
import Home from '../src/pages/index.astro';
import { attr, render } from './render';

const meta = (html: string, key: string) => {
  const el = new RegExp(`<meta[^>]*(?:name|property)="${key}"[^>]*>`).exec(html)?.[0] ?? '';
  return attr(el, 'content');
};

const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => JSON.parse(m[1] ?? 'null') as Record<string, unknown>,
  );

describe('homepage SEO', () => {
  it('has a canonical URL and Open Graph tags', async () => {
    const html = await render(Home);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/pusatk3\.id\/"/);
    expect(meta(html, 'og:type')).toBe('website');
    expect(meta(html, 'og:url')).toBe('https://pusatk3.id/');
    expect(meta(html, 'og:title')).toMatch(/PusatK3/);
    expect(meta(html, 'og:description')).toMatch(/Gratis untuk peserta/);
    expect(meta(html, 'og:image')).toMatch(/^https:\/\/pusatk3\.id\//);
    expect(meta(html, 'og:locale')).toBe('id_ID');
    expect(meta(html, 'og:image:width')).toBe('1920');
    expect(meta(html, 'og:image:height')).toBe('1080');
    expect(meta(html, 'og:image:alt')).toBeTruthy();
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
  });

  it('describes the organisation and site search as JSON-LD', async () => {
    const blocks = jsonLd(await render(Home));
    const types = blocks.map((b) => b['@type']);
    expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite']));
    const org = blocks.find((b) => b['@type'] === 'Organization');
    expect(org?.description).toMatch(/bukan situs pemerintah/);
    const site = blocks.find((b) => b['@type'] === 'WebSite') as {
      potentialAction?: { target?: string };
    };
    expect(site.potentialAction?.target).toBe('https://pusatk3.id/cari?q={search_term_string}');
  });

  it('adds VideoObject only when the video URL is configured (not in this build)', async () => {
    const types = jsonLd(await render(Home)).map((b) => b['@type']);
    expect(types).not.toContain('VideoObject');
  });

  it('opens with a short, quotable answer sentence', async () => {
    const html = await render(Home);
    expect(html).toMatch(/PusatK3 adalah direktori independen pelatihan dan sertifikasi K3/);
  });
});

describe('JsonLd', () => {
  it('cannot be broken out of with </script>', async () => {
    const html = await render(JsonLd, {
      data: { '@type': 'Thing', name: '</script><script>alert(1)</script>' },
    });
    expect(html).not.toContain('</script><script>');
    expect(jsonLd(html)[0]?.name).toBe('</script><script>alert(1)</script>');
  });
});

describe('robots.txt and sitemap.xml', () => {
  it('block crawlers outside production builds (tests do not set DEPLOY_ENV)', async () => {
    const text = await (await robots({} as never)).text();
    expect(text).toBe('User-agent: *\nDisallow: /\n');
  });

  it('list the public pages and never internal ones', async () => {
    const xml = await (await sitemap({} as never)).text();
    expect(xml).toContain('<loc>https://pusatk3.id/</loc>');
    expect(xml).not.toContain('internal');
  });
});
