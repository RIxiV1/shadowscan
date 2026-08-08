// Canonical vocabularies shared by the API and the web client.

// Who may do what.
export const ROLES = ['admin', 'analyst'] as const;

export type Role = (typeof ROLES)[number];

export const POLICY_STATUSES = ['approved', 'blocked', 'unknown'] as const;

export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export const PROVIDER_CATEGORIES = [
  'assistant',
  'coding',
  'search',
  'image',
  'audio',
  'video',
  'agent',
  'api',
  'other',
] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

// Risk bands.
export const RISK_BANDS = ['low', 'medium', 'high', 'critical'] as const;

export type RiskBand = (typeof RISK_BANDS)[number];

// Lifecycle of an uploaded log batch.
export const UPLOAD_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;

export type UploadStatus = (typeof UPLOAD_STATUSES)[number];

// Source formats the ingestion pipeline can parse.
export const SOURCE_FORMATS = [
  'csv',
  'json',
  'txt',
  'browser-history',
  'proxy-log',
] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];

export const SENSITIVE_CLASSES = [
  'email',
  'credit-card',
  'aadhaar',
  'phone',
  'api-key',
  'jwt',
  'private-key',
  'ip-address',
  'keyword',
] as const;
export type SensitiveClass = (typeof SENSITIVE_CLASSES)[number];

// Reason a risk contribution was added, used to explain a score to an auditor.
export const RISK_FACTOR_KINDS = [
  'provider-base',
  'policy-blocked',
  'policy-unknown',
  'sensitive-content',
  'off-hours',
  'volume',
  'data-residency',
] as const;
export type RiskFactorKind = (typeof RISK_FACTOR_KINDS)[number];
