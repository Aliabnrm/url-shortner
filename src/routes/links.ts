import express, { Router } from 'express';
import { AppError } from '../errors/app-error.js';
import { LinkService, SHORT_CODE_PATTERN } from '../links/link-service.js';

export function createLinksRouter(service: LinkService, publicBaseUrl: string) {
  const router = Router();

  router.post(
    '/api/urls',
    (req, _res, next) => {
      const mediaType = req
        .get('content-type')
        ?.split(';')[0]
        ?.trim()
        .toLowerCase();
      if (mediaType !== 'application/json') {
        throw new AppError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Content-Type must be application/json.',
        );
      }
      next();
    },
    express.json({ limit: '8kb', inflate: false }),
    (req, res) => {
      const link = service.create(req.body as unknown);
      const shortUrl = new URL(`/${link.shortCode}`, publicBaseUrl).href;

      res
        .location(shortUrl)
        .status(201)
        .json({ ...link, shortUrl });
    },
  );

  router.get('/:code', (req, res, next) => {
    if (!SHORT_CODE_PATTERN.test(req.params.code)) {
      next();
      return;
    }

    const link = service.find(req.params.code);
    res.set('Cache-Control', 'no-store').redirect(302, link.originalUrl);
  });

  return router;
}
