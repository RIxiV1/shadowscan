import type {
  AiEventDto,
  AuditLogDto,
  ProviderDto,
  RiskReportDto,
  RiskSettingsDto,
  UploadDto,
  UserDto,
} from '@shadowscan/shared';
import type { AiEventDoc } from '../models/AiEvent.js';
import type { AuditLogDoc } from '../models/AuditLog.js';
import type { ProviderDoc } from '../models/Provider.js';
import type { RiskReportDoc } from '../models/RiskReport.js';
import type { RiskSettingsDoc } from '../models/RiskSettings.js';
import type { UploadDoc } from '../models/Upload.js';
import type { UserDoc } from '../models/User.js';

// Explicit document -> DTO projection.

type WithPopulatedRef = { _id: unknown; name?: unknown } | null | undefined;

function idOf(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function iso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function requiredIso(value: Date | null | undefined): string {
  return (value ? new Date(value) : new Date(0)).toISOString();
}

function refOf(value: unknown): { id: string; name: string } | null {
  if (!value) return null;
  if (typeof value === 'object' && '_id' in (value as object)) {
    const populated = value as WithPopulatedRef;
    return { id: idOf(populated?._id), name: String(populated?.name ?? 'Unknown') };
  }
  return { id: idOf(value), name: 'Unknown' };
}

export function toUserDto(doc: UserDoc): UserDto {
  return {
    id: doc.id as string,
    email: doc.email,
    name: doc.name,
    role: doc.role,
    lastLoginAt: iso(doc.lastLoginAt),
    createdAt: requiredIso((doc as unknown as { createdAt?: Date }).createdAt),
  };
}

export function toProviderDto(doc: ProviderDoc): ProviderDto {
  return {
    id: doc.id as string,
    key: doc.key,
    name: doc.name,
    vendor: doc.vendor,
    category: doc.category,
    domains: [...doc.domains],
    riskWeight: doc.riskWeight,
    policy: doc.policy,
    dataRegion: doc.dataRegion,
    trainsOnUserData: doc.trainsOnUserData,
    isBuiltIn: doc.isBuiltIn,
    notes: doc.notes ?? '',
    updatedAt: requiredIso((doc as unknown as { updatedAt?: Date }).updatedAt),
  };
}

export function toUploadDto(doc: UploadDoc): UploadDto {
  return {
    id: doc.id as string,
    filename: doc.filename,
    sizeBytes: doc.sizeBytes,
    format: doc.format,
    status: doc.status,
    rowsTotal: doc.rowsTotal,
    rowsParsed: doc.rowsParsed,
    rowsRejected: doc.rowsRejected,
    aiRequests: doc.aiRequests,
    shadowAiRequests: doc.shadowAiRequests,
    errors: [...doc.parseErrors],
    uploadedBy: refOf(doc.uploadedBy),
    createdAt: requiredIso((doc as unknown as { createdAt?: Date }).createdAt),
    completedAt: iso(doc.completedAt),
  };
}

export function toAiEventDto(doc: AiEventDoc): AiEventDto {
  return {
    id: doc.id as string,
    uploadId: idOf(doc.uploadId),
    actor: doc.actor,
    host: doc.host,
    path: doc.path,
    occurredAt: requiredIso(doc.occurredAt),
    provider: doc.providerKey
      ? {
          key: doc.providerKey,
          name: doc.providerName ?? doc.providerKey,
          category: doc.providerCategory ?? 'other',
        }
      : null,
    policy: doc.policy,
    riskScore: doc.riskScore,
    riskBand: doc.riskBand,
    riskFactors: doc.riskFactors.map((factor) => ({
      kind: factor.kind,
      label: factor.label,
      points: factor.points,
    })),
    sensitiveHits: doc.sensitiveHits.map((hit) => ({ class: hit.class, count: hit.count })),
  };
}

export function toRiskReportDto(doc: RiskReportDoc): RiskReportDto {
  return {
    id: doc.id as string,
    title: doc.title,
    periodStart: requiredIso(doc.periodStart),
    periodEnd: requiredIso(doc.periodEnd),
    score: doc.score,
    band: doc.band,
    summary: {
      totalEvents: doc.summary.totalEvents,
      aiRequests: doc.summary.aiRequests,
      shadowAiRequests: doc.summary.shadowAiRequests,
      approvedRequests: doc.summary.approvedRequests,
      uniqueActors: doc.summary.uniqueActors,
      uniqueProviders: doc.summary.uniqueProviders,
      sensitiveHits: doc.summary.sensitiveHits,
    },
    topProviders: doc.topProviders.map((provider) => ({
      key: provider.key,
      name: provider.name,
      requests: provider.requests,
      policy: provider.policy,
    })),
    topActors: doc.topActors.map((actor) => ({
      actor: actor.actor,
      requests: actor.requests,
      score: actor.score,
      band: actor.band,
    })),
    recommendations: doc.recommendations.map((recommendation) => ({
      severity: recommendation.severity,
      title: recommendation.title,
      detail: recommendation.detail,
    })),
    generatedBy: refOf(doc.generatedBy),
    createdAt: requiredIso((doc as unknown as { createdAt?: Date }).createdAt),
  };
}

export function toRiskSettingsDto(doc: RiskSettingsDoc): RiskSettingsDto {
  return {
    unknownProviderWeight: doc.unknownProviderWeight,
    blockedProviderMultiplier: doc.blockedProviderMultiplier,
    sensitiveKeywordWeight: doc.sensitiveKeywordWeight,
    sensitiveIdentifierWeight: doc.sensitiveIdentifierWeight,
    offHoursWeight: doc.offHoursWeight,
    offHoursStart: doc.offHoursStart,
    offHoursEnd: doc.offHoursEnd,
    confidentialKeywords: [...doc.confidentialKeywords],
    actorSaturationScore: doc.actorSaturationScore,
    updatedAt: requiredIso((doc as unknown as { updatedAt?: Date }).updatedAt),
  };
}

export function toAuditLogDto(doc: AuditLogDoc): AuditLogDto {
  return {
    id: doc.id as string,
    actorId: doc.actorId ? idOf(doc.actorId) : null,
    actorEmail: doc.actorEmail,
    action: doc.action,
    target: doc.target,
    metadata: (doc.metadata as Record<string, unknown>) ?? {},
    ip: doc.ip,
    createdAt: requiredIso(doc.createdAt),
  };
}
