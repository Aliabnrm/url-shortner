import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.set('Cache-Control', 'no-store').status(200).json({ status: 'ok' });
});
