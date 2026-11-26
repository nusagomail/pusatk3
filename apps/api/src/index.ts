import { createApp } from './app';

// Deployed app: public GET responses go through the edge cache (ADR 0021).
export default createApp({ edgeCache: { cache: () => caches.default } });
