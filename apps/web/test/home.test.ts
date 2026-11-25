import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import IntroVideo from '../src/components/home/IntroVideo.astro';
import { FEATURED_FIELDS, SAMPLE_SCHEDULES } from '../src/data/home';
import Home from '../src/pages/index.astro';
import { attr, render, tag } from './render';

const csv = readFileSync(
  resolve(import.meta.dirname, '../../../docs/data/kategori-k3.csv'),
  'utf8',
);

describe('homepage', () => {
  it('has the sections from docs/ui-halaman.md in order, with one h1', async () => {
    const html = await render(Home);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    const headings = [...html.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/g)].map((m) =>
      (m[1] ?? '').replace(/<[^>]+>/g, '').trim(),
    );
    const order = [
      'Temukan pelatihan & sertifikasi K3 terpercaya di seluruh Indonesia',
      'Bidang K3',
      'Jadwal terdekat',
      'Cari berdasarkan kota',
      'Cara kerja PusatK3',
      'Kenali PusatK3',
      'Anda penyedia pelatihan K3?',
    ];
    const positions = order.map((h) => headings.findIndex((x) => x.replace('&amp;', '&') === h));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('has a labelled GET search form to /cari that needs no login', async () => {
    const html = await render(Home);
    const form = tag(html, 'form', 'hero__search');
    expect(attr(form, 'action')).toBe('/cari');
    expect(attr(form, 'method')).toBe('get');
    expect(html).toMatch(/<label[^>]*for="hero-q"/);
    expect(html).toMatch(/<label[^>]*for="hero-city"/);
  });

  it('states the trust points and that providers are contacted directly', async () => {
    const html = await render(Home);
    for (const text of [
      'Legalitas penyedia diverifikasi',
      'Sertifikasi Kemnaker &amp; BNSP',
      'Hubungi penyedia tanpa perantara',
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toMatch(/Pendaftaran dan pembayaran langsung ke penyedia/);
  });

  it('labels every sample schedule so nobody mistakes it for a real one', async () => {
    const html = await render(Home);
    const section = /<section[^>]*id="jadwal"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    expect(section).toContain('Contoh tampilan');
    expect(section.match(/class="[^"]*schedule-card\b/g)).toHaveLength(SAMPLE_SCHEDULES.length);
    expect(section.match(/>Contoh</g)).toHaveLength(SAMPLE_SCHEDULES.length);
  });

  it('links the provider call to action to /untuk-penyedia', async () => {
    expect(await render(Home)).toMatch(/href="\/untuk-penyedia"[^>]*>\s*Klaim profil gratis/);
  });
});

describe('featured fields', () => {
  const counts = new Map<string, number>();
  for (const line of csv.trim().split('\n').slice(1)) {
    const slug = line.split(',')[0] ?? '';
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  it('shows 8 of the 14 official fields with their real certification counts', () => {
    expect(FEATURED_FIELDS).toHaveLength(8);
    for (const field of FEATURED_FIELDS) {
      expect(counts.get(field.slug), field.slug).toBe(field.count);
    }
  });

  it('renders each field with its count', async () => {
    const html = await render(Home);
    for (const field of FEATURED_FIELDS) expect(html).toContain(`${field.count} sertifikasi`);
  });
});

describe('IntroVideo', () => {
  it('without a media URL shows the poster and transcript, but no video or play button', async () => {
    const html = await render(IntroVideo, {});
    expect(html).not.toContain('<video');
    expect(attr(tag(html, 'img'), 'alt')).toBeTruthy();
    expect(html).toMatch(/<details[\s\S]*Baca transkrip[\s\S]*Kenalkan, PusatK3/);
  });

  it('with a media URL plays only on request, with Indonesian captions', async () => {
    const html = await render(IntroVideo, { mediaBaseUrl: 'https://media.pusatk3.id' });
    const video = tag(html, 'video');
    expect(attr(video, 'src')).toBe('https://media.pusatk3.id/pusatk3-intro.mp4');
    expect(attr(video, 'preload')).toBe('none');
    expect(video).toMatch(/\scontrols\b/);
    expect(video).toMatch(/\splaysinline\b/);
    expect(video).not.toMatch(/autoplay/);
    const track = tag(html, 'track');
    expect(attr(track, 'kind')).toBe('captions');
    expect(attr(track, 'srclang')).toBe('id');
  });

  it('ignores a non-https media URL', async () => {
    const html = await render(IntroVideo, { mediaBaseUrl: 'javascript:alert(1)//' });
    expect(html).not.toContain('<video');
    expect(html).not.toContain('javascript:');
  });
});
