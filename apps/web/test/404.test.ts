import { expect, it } from 'vitest';
import NotFound from '../src/pages/404.astro';
import { render } from './render';

it('404 page is noindex, explains, and links home', async () => {
  const html = await render(NotFound);
  expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  expect(html).toMatch(/<h1[^>]*>[^<]*tidak ditemukan/i);
  expect(html).toMatch(/href="\/"[^>]*>[^<]*Beranda/);
});
