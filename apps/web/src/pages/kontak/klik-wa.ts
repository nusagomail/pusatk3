import type { APIRoute } from 'astro';
import { apiPost } from '../../lib/api';
import { CLICK_BODY_MAX_BYTES, parseClickBeacon } from '../../lib/leads';

// WhatsApp click beacon (#28, ADR 0022): the button opens wa.me directly; the browser sends
// `navigator.sendBeacon` here, and this forwards it to the API (with the visitor IP for the rate
// limit). Always 204: the visitor is already in WhatsApp, and nothing is revealed to the caller.
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const length = Number(request.headers.get('content-length') ?? '0');
  // sendBeacon always sends Content-Length; a body without one (streamed) is never read.
  if (length > 0 && length <= CLICK_BODY_MAX_BYTES) {
    const click = parseClickBeacon(await request.text());
    if (click) await apiPost('/leads/whatsapp', click);
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
};
