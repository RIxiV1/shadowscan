import type { ApiError, ApiErrorCode, ApiFieldError, ApiResponse } from '@shadowscan/shared';

// API CLIENT One fetch wrapper for the whole app.

const STORAGE_KEY = 'shadowscan.token';

export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

export class ApiRequestError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields: ApiFieldError[];

  constructor(status: number, code: ApiErrorCode, message: string, fields: ApiFieldError[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
  fieldError(field: string): string | undefined {
    return this.fields.find((entry) => entry.field === field)?.message;
  }
}

// --------------------------------------------------------------- token ---

let accessToken: string | null = readStoredToken();
const expiryListeners = new Set<() => void>();

function readStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can throw in hardened browser configurations; an in-memory token
    // still works for the current page.
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  try {
    if (token) window.sessionStorage.setItem(STORAGE_KEY, token);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // non-fatal
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function onSessionExpired(listener: () => void): () => void {
  expiryListeners.add(listener);
  return () => expiryListeners.delete(listener);
}

function notifySessionExpired(): void {
  setAccessToken(null);
  for (const listener of expiryListeners) listener();
}

// -------------------------------------------------------------- request ---

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  // Set for multipart uploads: the browser must generate the boundary itself.
  rawBody?: BodyInit;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, rawBody, query, headers, ...init } = options;

  const url = new URL(
    `${API_BASE_URL}${path}`,
    // Relative bases need an origin to construct; absolute VITE_API_URL ignores it.
    window.location.origin,
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const requestHeaders = new Headers(headers);
  if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`);
  if (body !== undefined && !rawBody) requestHeaders.set('Content-Type', 'application/json');

  const response = await fetch(url.toString(), {
    ...init,
    headers: requestHeaders,
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (response.status === 401) {
    notifySessionExpired();
    const payload = await safeJson(response);
    throw toError(response.status, payload, 'Your session has ended. Please sign in again.');
  }

  if (response.status === 204) return undefined as T;

  // Non-JSON success responses (the PDF export) are handled by their own caller.
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiRequestError(
        response.status,
        'INTERNAL_ERROR',
        `Cannot reach the ShadowScan API (HTTP ${response.status}). Check that the API server is running — "npm run dev:api" — and that it connected to MongoDB.`,
      );
    }
    return (await response.blob()) as T;
  }

  const payload = (await safeJson(response)) as ApiResponse<T> | null;

  if (!response.ok || !payload || payload.ok === false) {
    throw toError(response.status, payload, 'Request failed.');
  }

  return payload.data;
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<T>(path, { method: 'POST', rawBody: form });
}

// Fetches a binary export and triggers a browser download.
export async function downloadFile(path: string, filename: string): Promise<void> {
  const blob = await apiRequest<Blob>(path, { method: 'GET' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in Safari; one tick is enough.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toError(status: number, payload: unknown, fallback: string): ApiRequestError {
  const error = (payload as ApiError | null)?.error;
  return new ApiRequestError(
    status,
    error?.code ?? 'INTERNAL_ERROR',
    error?.message ?? fallback,
    error?.fields ?? [],
  );
}
