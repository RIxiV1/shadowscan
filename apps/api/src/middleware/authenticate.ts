import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@shadowscan/shared';
import { AppError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { User } from '../models/User.js';

// Bearer-token authentication.
export const authenticate: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw AppError.unauthenticated('Missing bearer token.');
    }

    const claims = verifyAccessToken(header.slice(7).trim());

    const user = await User.findById(claims.sub).select('email role tokenVersion');
    if (!user) throw AppError.unauthenticated('Account no longer exists.');
    if (user.tokenVersion !== claims.tokenVersion) {
      throw AppError.unauthenticated('Session was revoked. Please sign in again.');
    }

    req.auth = { userId: user.id as string, email: user.email, role: user.role as Role };
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role gate. Always used *after* `authenticate`.
 *
 * Authorisation is enforced per route rather than inferred from the URL prefix:
 * a prefix convention breaks silently the first time someone adds a route in the
 * wrong place, and a missing check on a policy-mutating endpoint is a privilege
 * escalation.
 */
export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(AppError.unauthenticated());
    if (!allowed.includes(req.auth.role)) {
      return next(
        AppError.forbidden(`This action requires one of the following roles: ${allowed.join(', ')}.`),
      );
    }
    return next();
  };
}
