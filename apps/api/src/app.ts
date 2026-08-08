import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { AppError } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { apiRouter } from './routes.js';

// APPLICATION ASSEMBLY Middleware order is load-bearing and is worth reading top to bottom: trust proxy must come first, o
export function createApp(): Express {
  const app = express();

  // Render and Vercel each put exactly one proxy in front of the app. `1` rather
  // than `true`: trusting the whole chain lets a client spoof X-Forwarded-For and
  // forge its own IP for rate limiting and audit purposes.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // This process serves JSON and PDFs, never HTML, so the default CSP would
      // apply to nothing. A restrictive one is set anyway to harden the error
      // pages Express can still emit.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: env.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  app.use(
    cors({
      // An allowlist, not a reflector. `origin: true` echoes whatever the caller
      // sends, which with credentials enabled is equivalent to no CORS at all.
      origin(origin, callback) {
        // Same-origin and server-to-server requests carry no Origin header.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.has(origin)) return callback(null, true);
        return callback(new AppError(403, 'FORBIDDEN', `Origin ${origin} is not allowed.`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86_400,
    }),
  );

  // 256 KB is generous for every JSON endpoint in this API. File uploads do not
  // pass through here - multer handles multipart with its own, larger limit.
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  app.use(
    pinoHttp({
      logger,
      // Health checks fire every 30 seconds on Render and would otherwise be
      // 95% of the log volume.
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      customLogLevel(_req, res, error) {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.use('/api', apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
