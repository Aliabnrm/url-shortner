import express from 'express';
import { LinkService } from './links/link-service.js';
import { MemoryLinkStore } from './links/link-store.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { healthRouter } from './routes/health.js';
import { createLinksRouter } from './routes/links.js';

interface AppOptions {
  publicBaseUrl?: string;
  store?: MemoryLinkStore;
  generateCode?: () => string;
}

export function createApp({
  publicBaseUrl = 'http://127.0.0.1:3000',
  store = new MemoryLinkStore(),
  generateCode,
}: AppOptions = {}) {
  const app = express();
  const service = new LinkService(store, generateCode);

  app.disable('x-powered-by');
  app.use(healthRouter);
  app.use(createLinksRouter(service, publicBaseUrl));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
