import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { verifyRequestOrigin } from './middleware/origin.middleware.js';
import apiRoutes from './routes/index.js';
import { AppError } from './utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );

  app.use(
    cors((req, callback) => {
      const origin = req.get('origin');
      if (!origin || env.allowedOrigins.includes(origin)) {
        return callback(null, { origin: true, credentials: true });
      }

      const host = req.get('host');
      if (host) {
        try {
          const parsedOrigin = new URL(origin);
          if (parsedOrigin.host === host) {
            return callback(null, { origin: true, credentials: true });
          }
        } catch (_err) {
          // Malformed Origin falls through to 403
        }
      }

      return callback(
        new AppError(
          'Cross-origin request blocked by CORS policy.',
          403,
          'FORBIDDEN_ORIGIN'
        )
      );
    })
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());

  // Origin check for cookie-authenticated API mutations
  app.use('/api', verifyRequestOrigin);

  // REST API routes
  app.use('/api', apiRoutes);

  // Unknown API routes always return JSON 404 (never fall through to SPA HTML)
  app.use('/api', notFoundHandler);

  // Serve built React SPA when client/dist exists (production or local preview)
  const clientDistDir = path.resolve(__dirname, '../../client/dist');
  const clientIndexHtml = path.join(clientDistDir, 'index.html');

  if (fs.existsSync(clientIndexHtml)) {
    app.use(express.static(clientDistDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      return res.sendFile(clientIndexHtml);
    });
  }

  app.use(errorHandler);

  return app;
}
