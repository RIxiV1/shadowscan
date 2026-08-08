import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { AppError } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

// Schema validation at the edge.
export function validate(schema: ZodTypeAny, source: Source = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const fields = (result.error as z.ZodError).issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      return next(AppError.badRequest('The request did not pass validation.', fields));
    }

    // `req.query` and `req.params` are getter-only in Express 5 and plain
    // properties in Express 4; defining the property works in both.
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    return next();
  };
}
