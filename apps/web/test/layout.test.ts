import { describe, expect, it } from 'vitest';
import Footer from '../src/components/Footer.astro';
import Header from '../src/components/Header.astro';
import BaseLayout from '../src/layouts/BaseLayout.astro';
import { attr, render, tag } from './render';

describe('Footer', () => {
  it('always states it is an independent directory, not a government site', async () => {
    const html = await render(Footer);
    expect(html).toContain('Direktori independen, bukan situs pemerintah');
    expect(html).toMatch(/tidak menyelenggarakan pelatihan/);
  });

  it('links to how results are ordered and the legal pages', async () => {
    const html = await render(Footer);
    for (const href of ['/cara-mengurutkan-hasil', '/privasi', '/syarat', '/disclaimer']) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain(`© ${new Date().getFullYear()} PusatK3`);
  });
});

describe('Header', () => {
  it('links the logo home with an accessible name', async () => {
    const html = await render(Header);
    expect(attr(tag(html, 'a', 'header__brand'), 'href')).toBe('/');
    expect(attr(tag(html, 'a', 'header__brand'), 'aria-label')).toBe('PusatK3 — Beranda');
  });

  it('has a labelled main navigation with the core links', async () => {
    const html = await render(Header);
    expect(attr(tag(html, 'nav'), 'aria-label')).toBe('Navigasi utama');
    for (const href of ['/cari', '/belajar', '/untuk-penyedia', '/bantuan', '/masuk']) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it('marks the current page', async () => {
    const html = await render(Header, { current: '/cari' });
    expect(/<a\b[^>]*href="\/cari"[^>]*>/.exec(html)?.[0]).toMatch(/aria-current="page"/);
  });

  it('has a keyboard-reachable theme toggle with state', async () => {
    const toggle = tag(await render(Header), 'button', 'theme-toggle');
    expect(attr(toggle, 'type')).toBe('button');
    expect(attr(toggle, 'aria-pressed')).toBe('false');
    expect(attr(toggle, 'aria-label')).toBe('Mode gelap');
  });
});

describe('BaseLayout', () => {
  it('sets language, title, description and a skip link', async () => {
    const html = await render(BaseLayout, { title: 'Uji', description: 'Deskripsi uji' });
    expect(tag(html, 'html')).toMatch(/lang="id"/);
    expect(html).toContain('<title>Uji</title>');
    expect(html).toMatch(/<meta name="description" content="Deskripsi uji"/);
    expect(attr(tag(html, 'a', 'skip-link'), 'href')).toBe('#konten');
    expect(attr(tag(html, 'main'), 'id')).toBe('konten');
  });

  it('is indexable by default and noindex on request', async () => {
    expect(await render(BaseLayout, { title: 'A', description: 'B' })).not.toMatch(/noindex/);
    expect(await render(BaseLayout, { title: 'A', description: 'B', noindex: true })).toMatch(
      /<meta name="robots" content="noindex, nofollow"/,
    );
  });

  it('applies the stored theme before the stylesheet paints', async () => {
    const html = await render(BaseLayout, { title: 'A', description: 'B' });
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toMatch(/<script>[^<]*dataset\.theme/);
  });
});
