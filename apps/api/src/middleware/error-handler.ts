import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import type { ApiError } from '@shadowscan/shared';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.path}`));
};

// The single exit point for every failure.
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = toAppError(error);

  const logPayload = {
    err: error,
    code: appError.code,
    status: appError.status,
    method: req.method,
    path: req.path,
    userId: req.auth?.userId,
    context: appError.context,
  };

  if (appError.status >= 500) logger.error(logPayload, appError.message);
  else logger.warn(logPayload, appError.message);

  const body: ApiError = {
    ok: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.fields ? { fields: appError.fields } : {}),
    },
  };

  res.status(appError.status).json(body);
};

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return AppError.payloadTooLarge(
        `The file exceeds the ${(env.MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)} MB upload limit.`,
      );
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return AppError.badRequest('Send exactly one file in a field named "file".');
    }
    return AppError.badRequest(`Upload rejected: ${error.message}`);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const fields = Object.entries(error.errors).map(([field, detail]) => ({
      field,
      message: detail.message,
    }));
    return AppError.badRequest('The request did not pass validation.', fields);
  }

  if (error instanceof mongoose.Error.CastError) {
    // Do not echo the offending value - it is attacker-controlled and would be
    // reflected straight back into the client.
    return AppError.badRequest(`"${error.path}" is not a valid identifier.`);
  }

  if (isDuplicateKeyError(error)) {
    return AppError.conflict('A record with those details already exists.');
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return AppError.badRequest('The request body is not valid JSON.');
  }

  return AppError.internal('Something went wrong. The incident has been logged.', error);
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}
