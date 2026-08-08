import { Router } from 'express';
import type { FilterQuery } from 'mongoose';
import { z } from 'zod';
import { POLICY_STATUSES, RISK_BANDS } from '@shadowscan/shared';
import { AppError } from '../../lib/errors.js';
import { asyncHandler, pathParam, sendOk } from '../../lib/http.js';
import { toAiEventDto } from '../../lib/mappers.js';
import { paginate, resolvePage } from '../../lib/pagination.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { AiEvent, type AiEventAttrs } from '../../models/AiEvent.js';

export const eventsRouter: Router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional(),
  policy: z.enum(POLICY_STATUSES).optional(),
  band: z.enum(RISK_BANDS).optional(),
  providerKey: z.string().trim().max(64).optional(),
  uploadId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  actor: z.string().trim().max(190).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  // An allowlist, not a passthrough: an arbitrary sort field lets a caller force
  // a collection scan on an unindexed column and stall the single API process.
  sort: z.enum(['occurredAt', 'riskScore']).default('occurredAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

eventsRouter.use(authenticate);

// GET /api/events The investigation surface: every detection, filterable by tool, policy, risk band, person, upload and date range.
eventsRouter.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listQuerySchema>;
    const page = resolvePage(query);
    const filter: FilterQuery<AiEventAttrs> = {};

    if (query.policy) filter.policy = query.policy;
    if (query.band) filter.riskBand = query.band;
    if (query.providerKey) filter.providerKey = query.providerKey;
    if (query.uploadId) filter.uploadId = query.uploadId;
    if (query.actor) filter.actor = query.actor;

    if (query.from || query.to) {
      filter.occurredAt = {};
      if (query.from) filter.occurredAt.$gte = query.from;
      if (query.to) filter.occurredAt.$lte = query.to;
    }

    if (query.search) {
      // Anchored prefix match rather than a free `.*term.*`: an unanchored regex
      // cannot use the index on `host`, so a search on a large collection would
      // degrade into a full scan.
      const pattern = new RegExp(`^${escapeRegex(query.search)}`, 'i');
      const contains = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ host: pattern }, { actor: contains }, { providerName: contains }];
    }

    const [items, total] = await Promise.all([
      AiEvent.find(filter)
        .sort({ [query.sort]: query.order === 'asc' ? 1 : -1 })
        .skip(page.skip)
        .limit(page.limit),
      AiEvent.countDocuments(filter),
    ]);

    sendOk(res, paginate(items.map(toAiEventDto), total, page));
  }),
);
eventsRouter.get(
  '/:id',
  validate(z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }), 'params'),
  asyncHandler(async (req, res) => {
    const event = await AiEvent.findById(pathParam(req, 'id'));
    if (!event) throw AppError.notFound('Event');
    sendOk(res, toAiEventDto(event));
  }),
);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
