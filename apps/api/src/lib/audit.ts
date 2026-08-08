import type { Request } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { logger } from './logger.js';

/**
 * Records a security-relevant action.
 *
 * Deliberately fire-and-forget with a swallowed error: an audit write must never
 * be the reason a policy change fails. The failure is logged at `error` level so
 * a missing trail is still visible in operations, but the user's action completes.
 * (In a system with regulatory audit requirements this trade flips - there, the
 * write is part of the transaction and its failure aborts the action.)
 */
export function recordAudit(
  req: Request,
  action: string,
  target: string,
  metadata: Record<string, unknown> = {},
): void {
  void AuditLog.create({
    actorId: req.auth?.userId ?? null,
    actorEmail: req.auth?.email ?? 'anonymous',
    action,
    target,
    metadata,
    ip: clientIp(req),
  }).catch((error: unknown) => {
    logger.error({ err: error, action, target }, 'Failed to write audit log entry');
  });
}

// Best-effort client IP.
function clientIp(req: Request): string {
  return (req.ip ?? req.socket.remoteAddress ?? 'unknown').slice(0, 64);
}

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILURE: 'auth.login.failure',
  LOGIN_LOCKED: 'auth.login.locked',
  REGISTER: 'auth.register',
  PASSWORD_CHANGE: 'auth.password.change',
  UPLOAD_CREATE: 'upload.create',
  UPLOAD_DELETE: 'upload.delete',
  PROVIDER_CREATE: 'provider.create',
  PROVIDER_UPDATE: 'provider.update',
  PROVIDER_POLICY: 'provider.policy',
  PROVIDER_DELETE: 'provider.delete',
  SETTINGS_UPDATE: 'settings.update',
  REPORT_GENERATE: 'report.generate',
  REPORT_EXPORT: 'report.export',
  REPORT_DELETE: 'report.delete',
} as const;
