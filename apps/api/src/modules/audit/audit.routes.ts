import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, sendOk } from '../../lib/http.js';
import { toAuditLogDto } from '../../lib/mappers.js';
import { paginate, resolvePage } from '../../lib/pagination.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { AuditLog } from '../../models/AuditLog.js';

export const auditRouter: Router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().trim().max(64).optional(),
});

// GET /api/audit - admin only Read-only by design: there is no endpoint that edits or deletes an audit entry.
auditRouter.get(
  '/',
  authenticate,
  requireRole('admin'),
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listQuerySchema>;
    const page = resolvePage(query);
    const filter = query.action ? { action: query.action } : {};

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit),
      AuditLog.countDocuments(filter),
    ]);

    sendOk(res, paginate(items.map(toAuditLogDto), total, page));
  }),
);
