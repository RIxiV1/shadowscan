import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, sendOk } from '../../lib/http.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { buildDashboard } from './analytics.service.js';

export const analyticsRouter: Router = Router();

const dashboardQuerySchema = z.object({
  // Capped at a year: the daily series is returned in full, and an unbounded
  // window would return an unbounded array.
  days: z.coerce.number().int().min(1).max(365).default(30),
});

analyticsRouter.use(authenticate);

// GET /api/analytics/dashboard?days=30
analyticsRouter.get(
  '/dashboard',
  validate(dashboardQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { days } = req.query as unknown as z.infer<typeof dashboardQuerySchema>;
    sendOk(res, await buildDashboard(days));
  }),
);
