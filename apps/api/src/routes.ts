import { Router } from 'express';
import mongoose from 'mongoose';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { eventsRouter } from './modules/events/events.routes.js';
import { providersRouter } from './modules/providers/providers.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';
import { sendOk } from './lib/http.js';

export const apiRouter: Router = Router();

// GET /api/health - unauthenticated Deliberately minimal.
apiRouter.get('/health', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    ok: dbReady,
    data: { status: dbReady ? 'healthy' : 'degraded', uptimeSeconds: Math.floor(process.uptime()) },
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/uploads', uploadsRouter);
apiRouter.use('/events', eventsRouter);
apiRouter.use('/providers', providersRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.get('/', (_req, res) => {
  sendOk(res, {
    name: 'ShadowScan API',
    endpoints: [
      'GET    /api/health',
      'POST   /api/auth/login',
      'GET    /api/auth/bootstrap-status',
      'POST   /api/auth/register',
      'GET    /api/auth/me',
      'POST   /api/auth/change-password',
      'GET    /api/analytics/dashboard',
      'POST   /api/uploads',
      'GET    /api/uploads',
      'GET    /api/uploads/:id',
      'DELETE /api/uploads/:id',
      'GET    /api/events',
      'GET    /api/events/:id',
      'GET    /api/providers',
      'POST   /api/providers',
      'PUT    /api/providers/:id',
      'PATCH  /api/providers/:id/policy',
      'DELETE /api/providers/:id',
      'GET    /api/settings/risk',
      'PATCH  /api/settings/risk',
      'POST   /api/reports',
      'GET    /api/reports',
      'GET    /api/reports/:id',
      'GET    /api/reports/:id/pdf',
      'DELETE /api/reports/:id',
      'GET    /api/audit',
    ],
  });
});
