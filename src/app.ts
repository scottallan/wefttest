import path from 'path';
import express, { Express } from 'express';
import { Config } from './config';
import { createSessionMiddleware } from './auth/session';
import { createAuthRouter } from './auth/oauth';
import { requireAuthPage } from './auth/middleware';
import { createHealthzRouter } from './routes/healthz';
import { createApiRouter } from './routes/api';

export function createApp(config: Config): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Health check must be reachable without auth and without session middleware concerns.
  app.use(createHealthzRouter());

  app.use(createSessionMiddleware(config));
  app.use(express.json());

  app.use('/auth', createAuthRouter(config));
  app.use('/api', createApiRouter(config));

  const publicDir = path.join(__dirname, '..', 'public');

  app.get('/dashboard.html', requireAuthPage, (_req, res) => {
    res.sendFile(path.join(publicDir, 'dashboard.html'));
  });

  app.use(express.static(publicDir));

  app.get('/', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}
