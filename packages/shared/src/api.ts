import type {
  AiEventDto,
  ProviderDto,
  RiskReportDto,
  UploadDto,
  UserDto,
} from './entities.js';
import type { PolicyStatus, ProviderCategory, RiskBand } from './enums.js';

// Transport envelopes and endpoint contracts.

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiError {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: ApiFieldError[];
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_FORMAT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface LoginResponse extends AuthTokens {
  user: UserDto;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
  // Required only while the instance has zero users, to claim the first admin account.
  bootstrapToken?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ------------------------------------------------------------- dashboard ---

export interface DashboardQuery {
  days?: number;
}

export interface DashboardSummary {
  window: { from: string; to: string; days: number };
  cards: {
    uploads: number;
    totalEvents: number;
    aiRequests: number;
    shadowAiRequests: number;
    approvedRequests: number;
    sensitiveHits: number;
    riskScore: number;
    riskBand: RiskBand;
  };
  // Percentage change against the immediately preceding window of equal length.
  trends: {
    aiRequests: number | null;
    shadowAiRequests: number | null;
    riskScore: number | null;
  };
  usageByTool: Array<{
    key: string;
    name: string;
    requests: number;
    policy: PolicyStatus;
    category: ProviderCategory;
  }>;
  usageByCategory: Array<{ category: ProviderCategory; requests: number }>;
  dailyUsage: Array<{
    date: string;
    aiRequests: number;
    shadowAiRequests: number;
    approvedRequests: number;
  }>;
  policyBreakdown: Array<{ policy: PolicyStatus; requests: number }>;
  highRiskActors: Array<{
    actor: string;
    requests: number;
    shadowRequests: number;
    sensitiveHits: number;
    score: number;
    band: RiskBand;
  }>;
}

// --------------------------------------------------------------- uploads ---

export interface UploadListQuery {
  page?: number;
  pageSize?: number;
}

export interface UploadResult {
  upload: UploadDto;
  // First few detections, so the UI can show a result preview without a second call.
  preview: AiEventDto[];
}

export interface EventListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  policy?: PolicyStatus;
  band?: RiskBand;
  providerKey?: string;
  uploadId?: string;
  actor?: string;
  from?: string;
  to?: string;
  sort?: 'occurredAt' | 'riskScore';
  order?: 'asc' | 'desc';
}

export interface ProviderListQuery {
  search?: string;
  policy?: PolicyStatus;
  category?: ProviderCategory;
}

export interface UpsertProviderRequest {
  name: string;
  vendor: string;
  category: ProviderCategory;
  domains: string[];
  riskWeight: number;
  policy: PolicyStatus;
  dataRegion: string;
  trainsOnUserData: boolean;
  notes?: string;
}

export interface UpdateProviderPolicyRequest {
  policy: PolicyStatus;
}

// -------------------------------------------------------------- settings ---

// Tunable knobs for the risk engine.
export interface RiskSettingsDto {
  unknownProviderWeight: number;
  blockedProviderMultiplier: number;
  sensitiveKeywordWeight: number;
  sensitiveIdentifierWeight: number;
  offHoursWeight: number;
  offHoursStart: number;
  offHoursEnd: number;
  // Case-insensitive substrings that flag confidential content in prompts/queries.
  confidentialKeywords: string[];
  actorSaturationScore: number;
  updatedAt: string;
}

export type UpdateRiskSettingsRequest = Partial<
  Omit<RiskSettingsDto, 'updatedAt'>
>;

// --------------------------------------------------------------- reports ---

export interface GenerateReportRequest {
  title?: string;
  from?: string;
  to?: string;
}

export type ReportListResponse = Paginated<RiskReportDto>;

// --------------------------------------------------------- response types ---

export type LoginResponseBody = ApiResponse<LoginResponse>;
export type MeResponseBody = ApiResponse<UserDto>;
export type DashboardResponseBody = ApiResponse<DashboardSummary>;
export type UploadResponseBody = ApiResponse<UploadResult>;
export type UploadListResponseBody = ApiResponse<Paginated<UploadDto>>;
export type EventListResponseBody = ApiResponse<EventListResult>;

/**
 * Detections page payload: one page of rows plus tallies over the whole filtered
 * set. The tallies deliberately ignore pagination - counting only the visible 25
 * rows would make the summary change as you page through, which is worse than
 * having no summary at all.
 */
export interface EventListResult extends Paginated<AiEventDto> {
  counts: {
    byBand: Record<RiskBand, number>;
    byPolicy: Record<PolicyStatus, number>;
    sensitive: number;
    actors: number;
  };
}

export type ProviderListResponseBody = ApiResponse<ProviderDto[]>;

export type ProviderResponseBody = ApiResponse<ProviderDto>;
export type RiskSettingsResponseBody = ApiResponse<RiskSettingsDto>;
export type ReportResponseBody = ApiResponse<RiskReportDto>;
