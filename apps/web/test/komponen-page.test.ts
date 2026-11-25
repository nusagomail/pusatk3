import { describe, expect, it } from 'vitest';
import Page from '../src/dev/komponen.astro';
import { render } from './render';

describe('/internal/komponen', () => {
  it('is kept out of search engines and shows every component', async () => {
    const html = await render(Page);
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    for (const text of [
      'btn--primary',
      'btn--secondary',
      'wa.me/',
      'Terverifikasi',
      'sponsor-label',
      'pill--accent',
      'class="card',
      '<select',
      '<input',
    ]) {
      expect(html).toContain(text);
    }
  });
});
