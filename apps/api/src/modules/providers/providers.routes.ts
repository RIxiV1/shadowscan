import { Router } from 'express';
import { z } from 'zod';
import { AUDIT_ACTIONS, recordAudit } from '../../lib/audit.js';
import { asyncHandler, pathParam, sendOk } from '../../lib/http.js';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import {
  listProvidersSchema,
  updatePolicySchema,
  upsertProviderSchema,
} from './providers.schemas.js';
import * as providersService from './providers.service.js';

export const providersRouter: Router = Router();

const objectIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid provider id.'),
});

// Everything in this module requires a session. Reads are open to analysts;
// every mutation is admin-only, because changing a policy or a weight changes
// what the platform reports and must be attributable to someone accountable.
providersRouter.use(authenticate);

// GET /api/providers?search=&policy=&category= 200 ProviderDto[]
providersRouter.get(
  '/',
  validate(listProvidersSchema, 'query'),
  asyncHandler(async (req, res) => {
    sendOk(res, await providersService.listProviders(req.query));
  }),
);

// POST /api/providers
providersRouter.post(
  '/',
  requireRole('admin'),
  validate(upsertProviderSchema),
  asyncHandler(async (req, res) => {
    const provider = await providersService.createProvider(req.body, req.auth!.userId);
    recordAudit(req, AUDIT_ACTIONS.PROVIDER_CREATE, provider.key, {
      domains: provider.domains,
      policy: provider.policy,
    });
    sendOk(res, provider, 201);
  }),
);
providersRouter.put(
  '/:id',
  requireRole('admin'),
  validate(objectIdParam, 'params'),
  validate(upsertProviderSchema),
  asyncHandler(async (req, res) => {
    const provider = await providersService.updateProvider(
      pathParam(req, 'id'),
      req.body,
      req.auth!.userId,
    );
    recordAudit(req, AUDIT_ACTIONS.PROVIDER_UPDATE, provider.key, {
      policy: provider.policy,
      riskWeight: provider.riskWeight,
    });
    sendOk(res, provider);
  }),
);
providersRouter.patch(
  '/:id/policy',
  requireRole('admin'),
  validate(objectIdParam, 'params'),
  validate(updatePolicySchema),
  asyncHandler(async (req, res) => {
    const provider = await providersService.updateProviderPolicy(
      pathParam(req, 'id'),
      req.body.policy,
      req.auth!.userId,
    );
    recordAudit(req, AUDIT_ACTIONS.PROVIDER_POLICY, provider.key, { policy: provider.policy });
    sendOk(res, provider);
  }),
);

// DELETE /api/providers/:id
providersRouter.delete(
  '/:id',
  requireRole('admin'),
  validate(objectIdParam, 'params'),
  asyncHandler(async (req, res) => {
    await providersService.deleteProvider(pathParam(req, 'id'));
    recordAudit(req, AUDIT_ACTIONS.PROVIDER_DELETE, pathParam(req, 'id'));
    res.status(204).end();
  }),
);
