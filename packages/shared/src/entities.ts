import type {
  PolicyStatus,
  ProviderCategory,
  RiskBand,
  RiskFactorKind,
  Role,
  SensitiveClass,
  SourceFormat,
  UploadStatus,
} from './enums.js';

/**
 * Wire-shaped entities.
 *
 * These describe what the API *serialises*, not what Mongo stores: `_id` is already
 * mapped to `id`, dates are ISO-8601 strings, and secrets (password hashes, raw
 * URLs containing credentials) are absent by construction. The Mongoose documents
 * in the API layer are separate types that project into these - that boundary is
 * what stops a hashed password from ever leaking into a JSON response by accident.
 */

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  lastLoginAt: string | null;
  createdAt: string;
}

// A single risk contribution, kept so any score can be explained line by line.
export interface RiskFactor {
  kind: RiskFactorKind;
  label: string;
  points: number;
}

export interface ProviderDto {
  id: string;
  // Stable machine key, e.g.
  key: string;
  name: string;
  vendor: string;
  category: ProviderCategory;
  domains: string[];
  riskWeight: number;
  policy: PolicyStatus;
  // ISO 3166-1 alpha-2 of the primary processing region, or `unknown`.
  dataRegion: string;
  // True when the vendor trains on customer data by default - a compliance flag.
  trainsOnUserData: boolean;
  isBuiltIn: boolean;
  notes: string;
  updatedAt: string;
}

export interface UploadDto {
  id: string;
  filename: string;
  sizeBytes: number;
  format: SourceFormat;
  status: UploadStatus;
  rowsTotal: number;
  rowsParsed: number;
  rowsRejected: number;
  aiRequests: number;
  // AI requests whose resolved policy was `blocked` or `unknown`.
  shadowAiRequests: number;
  errors: string[];
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AiEventDto {
  id: string;
  uploadId: string;
  actor: string;
  host: string;
  // Path only.
  path: string;
  occurredAt: string;
  provider: { key: string; name: string; category: ProviderCategory } | null;
  policy: PolicyStatus;
  riskScore: number;
  riskBand: RiskBand;
  riskFactors: RiskFactor[];
  sensitiveHits: Array<{ class: SensitiveClass; count: number }>;
}

export interface RiskReportDto {
  id: string;
  title: string;
  // Inclusive window the report covers.
  periodStart: string;
  periodEnd: string;
  score: number;
  band: RiskBand;
  summary: {
    totalEvents: number;
    aiRequests: number;
    shadowAiRequests: number;
    approvedRequests: number;
    uniqueActors: number;
    uniqueProviders: number;
    sensitiveHits: number;
  };
  topProviders: Array<{ key: string; name: string; requests: number; policy: PolicyStatus }>;
  topActors: Array<{ actor: string; requests: number; score: number; band: RiskBand }>;
  recommendations: Array<{ severity: RiskBand; title: string; detail: string }>;
  generatedBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorEmail: string;
  action: string;
  target: string;
  metadata: Record<string, unknown>;
  ip: string;
  createdAt: string;
}
