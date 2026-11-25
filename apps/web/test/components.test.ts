import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Button from '../src/components/Button.astro';
import Card from '../src/components/Card.astro';
import Input from '../src/components/Input.astro';
import Logo from '../src/components/Logo.astro';
import Pill from '../src/components/Pill.astro';
import Select from '../src/components/Select.astro';
import SponsorLabel from '../src/components/SponsorLabel.astro';
import VerifiedBadge from '../src/components/VerifiedBadge.astro';
import WhatsAppButton from '../src/components/WhatsAppButton.astro';
import { attr, render, tag } from './render';

const css = (file: string) =>
  readFileSync(resolve(import.meta.dirname, '../src/components', file), 'utf8');

describe('Button', () => {
  it('renders a <button type="button"> by default', async () => {
    const html = await render(Button, {}, 'Cari');
    const el = tag(html, 'button');
    expect(attr(el, 'type')).toBe('button');
    expect(el).toMatch(/btn--primary/);
    expect(html).toContain('Cari');
  });

  it('renders a link when href is given', async () => {
    const el = tag(await render(Button, { href: '/cari', variant: 'secondary' }, 'Cari'), 'a');
    expect(attr(el, 'href')).toBe('/cari');
    expect(el).toMatch(/btn--secondary/);
  });

  it('uses navy text on orange and a 44px touch target (CSS)', () => {
    const source = css('Button.astro');
    expect(source).toMatch(/\.btn--primary\s*\{[^}]*background:\s*var\(--color-accent\)/);
    expect(source).toMatch(/\.btn--primary\s*\{[^}]*color:\s*var\(--color-on-accent\)/);
    expect(source).toMatch(/min-height:\s*var\(--touch-target\)/);
    // Native button styling must never override theme colours (seen when the theme switches).
    expect(source).toMatch(/\.btn\s*\{[^}]*appearance:\s*none/);
  });
});

describe('WhatsAppButton', () => {
  it('opens wa.me safely in a new tab', async () => {
    const el = tag(await render(WhatsAppButton, { phone: '0812-3456-7890' }, 'Chat WhatsApp'), 'a');
    expect(attr(el, 'href')).toBe('https://wa.me/6281234567890');
    expect(attr(el, 'target')).toBe('_blank');
    expect(attr(el, 'rel')).toBe('noopener noreferrer');
  });

  it('keeps the visible text in its accessible name and announces the new tab', async () => {
    const html = await render(WhatsAppButton, { phone: '0812-3456-7890' }, 'Chat WhatsApp');
    expect(attr(tag(html, 'a'), 'aria-label')).toBeNull();
    expect(html).toContain('Chat WhatsApp');
    expect(html).toMatch(/class="visually-hidden"[^>]*>\s*\(membuka tab baru\)/);
  });

  it('adds an encoded prefilled message', async () => {
    const el = tag(
      await render(WhatsAppButton, { phone: '6281234567890', message: 'Halo & salam' }, 'WA'),
      'a',
    );
    expect(attr(el, 'href')).toBe('https://wa.me/6281234567890?text=Halo%20%26%20salam');
  });

  it('renders nothing (instead of a broken link or a 500) for an invalid number', async () => {
    const html = await render(WhatsAppButton, { phone: '123' }, 'Chat WhatsApp');
    expect(html).not.toContain('wa.me');
    expect(html).not.toContain('<a');
  });

  it('uses navy text on WhatsApp green (CSS)', () => {
    expect(css('WhatsAppButton.astro')).toMatch(/color:\s*var\(--color-on-accent\)/);
  });
});

describe('SponsorLabel', () => {
  it('always says "Sponsor" and looks different from ordinary pills', async () => {
    const html = await render(SponsorLabel);
    expect(html).toMatch(/>\s*Sponsor\s*</);
    expect(tag(html, 'span', 'sponsor-label')).not.toMatch(/\bpill\b/);
  });

  it('accepts no props, so the label cannot be renamed or hidden', () => {
    expect(css('SponsorLabel.astro')).not.toMatch(/interface Props/);
  });
});

describe('Pill', () => {
  it('renders text with a tone class', async () => {
    const el = tag(await render(Pill, { tone: 'accent' }, 'BNSP'), 'span', 'pill');
    expect(el).toMatch(/pill--accent/);
  });
});

describe('VerifiedBadge', () => {
  it('has readable text and a decorative icon', async () => {
    const html = await render(VerifiedBadge);
    expect(html).toContain('Terverifikasi');
    expect(attr(tag(html, 'svg'), 'aria-hidden')).toBe('true');
  });

  it('accepts no plan or payment input (badge is never sold)', () => {
    const props = /interface Props\s*\{([^}]*)\}/.exec(css('VerifiedBadge.astro'))?.[1] ?? '';
    expect(props).not.toMatch(/plan|paid|sponsor|subscription/i);
  });
});

describe('Card', () => {
  it('renders the slot inside an article by default', async () => {
    const html = await render(Card, {}, '<p>Isi</p>');
    expect(tag(html, 'article', 'card')).toBeTruthy();
    expect(html).toContain('<p>Isi</p>');
  });
});

describe('Input', () => {
  it('links a visible label to the field', async () => {
    const html = await render(Input, { label: 'Kota', name: 'city' });
    const input = tag(html, 'input');
    const id = attr(input, 'id');
    expect(id).toBeTruthy();
    expect(attr(tag(html, 'label'), 'for')).toBe(id);
  });

  it('keeps the label for screen readers when hidden', async () => {
    const html = await render(Input, { label: 'Cari pelatihan', name: 'q', hideLabel: true });
    expect(tag(html, 'label')).toMatch(/visually-hidden/);
  });

  it('announces hint and error via aria-describedby and aria-invalid', async () => {
    const html = await render(Input, {
      label: 'Nomor HP',
      name: 'phone',
      hint: 'Format 08…',
      error: 'Wajib diisi',
    });
    const input = tag(html, 'input');
    expect(attr(input, 'aria-invalid')).toBe('true');
    const describedBy = attr(input, 'aria-describedby')?.split(' ') ?? [];
    expect(describedBy).toHaveLength(2);
    for (const id of describedBy) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('Wajib diisi');
  });

  it('meets the 44px touch target and a ≥3:1 border (CSS)', () => {
    expect(css('Input.astro')).toMatch(/min-height:\s*var\(--touch-target\)/);
    expect(css('Input.astro')).toMatch(/border:\s*1px solid var\(--color-border-strong\)/);
    expect(css('Select.astro')).toMatch(/border:\s*1px solid var\(--color-border-strong\)/);
  });
});

describe('Select', () => {
  const options = [
    { value: '', label: 'Semua kota & online' },
    { value: 'jakarta', label: 'Jakarta' },
  ];

  it('renders a labelled select with options and the selected value', async () => {
    const html = await render(Select, { label: 'Kota', name: 'city', options, value: 'jakarta' });
    const select = tag(html, 'select');
    expect(attr(tag(html, 'label'), 'for')).toBe(attr(select, 'id'));
    const jakarta = /<option\b[^>]*value="jakarta"[^>]*>/.exec(html)?.[0] ?? '';
    expect(jakarta).toMatch(/\sselected\b/);
    const first = /<option\b[^>]*>/.exec(html)?.[0] ?? '';
    expect(first).not.toMatch(/\sselected\b/);
  });

  it('escapes option labels', async () => {
    const html = await render(Select, {
      label: 'Kota',
      name: 'city',
      options: [{ value: 'x', label: '<script>alert(1)</script>' }],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('Logo', () => {
  it('keeps the brand geometry from brand/logo-horizontal.svg', async () => {
    const brand = readFileSync(
      resolve(import.meta.dirname, '../../../brand/logo-horizontal.svg'),
      'utf8',
    );
    const html = await render(Logo);
    const geometry = (svg: string) =>
      [...svg.matchAll(/\b(?:d|cx|cy|r)="([^"]+)"/g)].map((m) => m[1]);
    expect(geometry(html)).toEqual(geometry(brand));
  });

  it('is labelled PusatK3 and keeps the centre dot orange', async () => {
    const html = await render(Logo);
    expect(attr(tag(html, 'svg'), 'aria-label')).toBe('PusatK3');
    expect(html).toMatch(/<circle cx="32" cy="32" r="10.5" fill="#E07400"/);
  });
});
