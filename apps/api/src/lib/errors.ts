import type { ApiErrorCode, ApiFieldError } from '@shadowscan/shared';

// The single error type the application throws.
export class AppError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields?: ApiFieldError[];
  readonly context?: Record<string, unknown>;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    options?: { fields?: ApiFieldError[]; context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (options?.fields) this.fields = options.fields;
    if (options?.context) this.context = options.context;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, fields?: ApiFieldError[]): AppError {
    return new AppError(400, 'VALIDATION_ERROR', message, fields ? { fields } : undefined);
  }

  static unauthenticated(message = 'Authentication is required.'): AppError {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }

  static invalidCredentials(): AppError {
    // Deliberately identical for "no such user" and "wrong password": distinguishing
    // them turns the login endpoint into an account-enumeration oracle.
    return new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  static tokenExpired(): AppError {
    return new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please sign in again.');
  }

  static forbidden(message = 'You do not have permission to perform this action.'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(resource = 'Resource'): AppError {
    return new AppError(404, 'NOT_FOUND', `${resource} was not found.`);
  }

  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICT', message);
  }

  static payloadTooLarge(message: string): AppError {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', message);
  }

  static unsupportedFormat(message: string): AppError {
    return new AppError(415, 'UNSUPPORTED_FORMAT', message);
  }

  static internal(message = 'Something went wrong.', cause?: unknown): AppError {
    return new AppError(500, 'INTERNAL_ERROR', message, cause !== undefined ? { cause } : undefined);
  }
}
