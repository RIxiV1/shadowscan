import { Router } from 'express';
import { AUDIT_ACTIONS, recordAudit } from '../../lib/audit.js';
import { asyncHandler, sendOk } from '../../lib/http.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { changePasswordSchema, loginSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

export const authRouter: Router = Router();

/**
 * POST /api/auth/login - public, rate limited
 * 200 { accessToken, expiresIn, user }
 * 401 INVALID_CREDENTIALS · 423 FORBIDDEN (locked) · 429 RATE_LIMITED
 */
authRouter.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    try {
      const outcome = await authService.login(req.body);
      recordAudit(req, AUDIT_ACTIONS.LOGIN_SUCCESS, outcome.user.email, {
        role: outcome.user.role,
      });
      sendOk(res, {
        accessToken: outcome.accessToken,
        expiresIn: outcome.expiresIn,
        user: outcome.user,
      });
    } catch (error) {
      // Failed sign-ins are the highest-value line in the audit trail; record the
      // attempt before rethrowing so the failure itself is never silent.
      recordAudit(req, AUDIT_ACTIONS.LOGIN_FAILURE, String(req.body?.email ?? 'unknown'));
      throw error;
    }
  }),
);

// GET /api/auth/bootstrap-status - public Tells the sign-in page whether this instance still has zero accounts.
authRouter.get(
  '/bootstrap-status',
  asyncHandler(async (_req, res) => {
    sendOk(res, { needsBootstrap: await authService.needsBootstrap() });
  }),
);

// POST /api/auth/register First account: public, requires `bootstrapToken`.
authRouter.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    // `authenticate` is not mounted on this route because the bootstrap case is
    // unauthenticated by definition. The caller's role is read opportunistically
    // and the service enforces the rule.
    const user = await authService.register(req.body, {
      callerRole: req.auth?.role ?? null,
      bootstrapToken: req.body.bootstrapToken,
    });
    recordAudit(req, AUDIT_ACTIONS.REGISTER, user.email, { role: user.role });
    sendOk(res, { user }, 201);
  }),
);

// GET /api/auth/me
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    sendOk(res, await authService.getProfile(req.auth!.userId));
  }),
);

// POST /api/auth/change-password - authenticated Revokes every existing session for the account on success.
authRouter.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await authService.changePassword(req.auth!.userId, req.body);
    recordAudit(req, AUDIT_ACTIONS.PASSWORD_CHANGE, req.auth!.email);
    res.status(204).end();
  }),
);
