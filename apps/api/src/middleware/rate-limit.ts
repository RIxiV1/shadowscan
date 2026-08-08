import rateLimit, { type Options } from 'express-rate-limit';
import type { ApiError } from '@shadowscan/shared';

const jsonResponse = (message: string): ApiError => ({
  ok: false,
  error: { code: 'RATE_LIMITED', message },
});

const shared: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
};

export const apiLimiter = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 300,
  message: jsonResponse('Too many requests. Slow down and try again shortly.'),
});

export const authLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email =
      typeof req.body === 'object' && req.body !== null && 'email' in req.body
        ? String((req.body as { email?: unknown }).email ?? '').toLowerCase()
        : '';
    return `${req.ip ?? 'unknown'}:${email}`;
  },
  message: jsonResponse('Too many sign-in attempts. Try again in 15 minutes.'),
});

export const uploadLimiter = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 12,
  message: jsonResponse('Too many uploads in quick succession. Wait a minute and retry.'),
});

export const reportLimiter = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 20,
  message: jsonResponse('Too many report generations. Wait a minute and retry.'),
});
