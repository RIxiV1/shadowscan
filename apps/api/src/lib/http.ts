import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ApiSuccess } from '@shadowscan/shared';

export function asyncHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, unknown>,
>(
  handler: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ) => Promise<unknown>,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    handler(req as never, res as never, next).catch(next);
  };
}

// Sends the one success envelope the whole API uses.
export function sendOk<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { ok: true, data };
  res.status(status).json(body);
}

// Reads a route parameter that a `validate(..., 'params')` guard has already proven present.
export function pathParam(req: Request, name: string): string {
  const value = (req.params as Record<string, string | undefined>)[name];
  if (value === undefined) {
    throw new Error(`Route parameter "${name}" is missing. Route is misconfigured.`);
  }
  return value;
}
