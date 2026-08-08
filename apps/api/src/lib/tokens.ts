import jwt from 'jsonwebtoken';
import type { Role } from '@shadowscan/shared';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

// JWT issuing and verification.
export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: Role;
  tokenVersion: number;
}

const ISSUER = 'shadowscan';
const AUDIENCE = 'shadowscan-web';

export function signAccessToken(claims: AccessTokenClaims): { token: string; expiresIn: number } {
  const token = jwt.sign(claims, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: ISSUER,
    audience: AUDIENCE,
  } as jwt.SignOptions);

  const decoded = jwt.decode(token) as { exp?: number; iat?: number } | null;
  const expiresIn =
    decoded?.exp && decoded?.iat ? decoded.exp - decoded.iat : 8 * 60 * 60;

  return { token, expiresIn };
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    // `algorithms` is pinned: without it, a token with `"alg":"none"` or an
    // attacker-chosen algorithm would be accepted by some verifier configurations.
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (typeof payload === 'string' || !payload.sub) {
      throw AppError.unauthenticated('Malformed access token.');
    }

    return {
      sub: String(payload.sub),
      email: String((payload as jwt.JwtPayload).email ?? ''),
      role: (payload as jwt.JwtPayload).role as Role,
      tokenVersion: Number((payload as jwt.JwtPayload).tokenVersion ?? 0),
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw AppError.tokenExpired();
    if (error instanceof AppError) throw error;
    throw AppError.unauthenticated('Invalid access token.');
  }
}
