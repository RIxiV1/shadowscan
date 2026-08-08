import { Router } from 'express';
import { z } from 'zod';
import { AUDIT_ACTIONS, recordAudit } from '../../lib/audit.js';
import { asyncHandler, sendOk } from '../../lib/http.js';
import { toRiskSettingsDto } from '../../lib/mappers.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { getRiskSettings } from '../../models/RiskSettings.js';

export const settingsRouter: Router = Router();

const updateSettingsSchema = z
  .object({
    unknownProviderWeight: z.number().min(0).max(50),
    blockedProviderMultiplier: z.number().min(1).max(10),
    sensitiveKeywordWeight: z.number().min(0).max(100),
    sensitiveIdentifierWeight: z.number().min(0).max(100),
    offHoursWeight: z.number().min(0).max(20),
    offHoursStart: z.number().int().min(0).max(23),
    offHoursEnd: z.number().int().min(0).max(23),
    confidentialKeywords: z
      .array(z.string().trim().min(3, 'Keywords shorter than 3 characters match too much.').max(64))
      .max(200),
    actorSaturationScore: z.number().min(10).max(10_000),
  })
  .partial();

settingsRouter.use(authenticate);

// GET /api/settings/risk 200 RiskSettingsDto
settingsRouter.get(
  '/risk',
  asyncHandler(async (_req, res) => {
    sendOk(res, toRiskSettingsDto(await getRiskSettings()));
  }),
);

// PATCH /api/settings/risk - admin Changing weights does not retroactively rescore stored events; see models/AiEvent.ts for why.
settingsRouter.patch(
  '/risk',
  requireRole('admin'),
  validate(updateSettingsSchema),
  asyncHandler(async (req, res) => {
    const settings = await getRiskSettings();
    const patch = req.body as Record<string, unknown>;

    // Deduplicate and normalise keywords here rather than trusting the client:
    // duplicates would multiply a single match into several risk points.
    if (Array.isArray(patch.confidentialKeywords)) {
      patch.confidentialKeywords = Array.from(
        new Set((patch.confidentialKeywords as string[]).map((keyword) => keyword.toLowerCase())),
      ).sort();
    }

    settings.set(patch);
    await settings.save();

    recordAudit(req, AUDIT_ACTIONS.SETTINGS_UPDATE, 'risk', { changed: Object.keys(patch) });
    sendOk(res, toRiskSettingsDto(settings));
  }),
);
