import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import {
  POLICY_STATUSES,
  PROVIDER_CATEGORIES,
  RISK_BANDS,
  RISK_FACTOR_KINDS,
  SENSITIVE_CLASSES,
} from '@shadowscan/shared';

// aievents - one normalised AI request.
const riskFactorSchema = new Schema(
  {
    kind: { type: String, enum: RISK_FACTOR_KINDS, required: true },
    label: { type: String, required: true, maxlength: 160 },
    points: { type: Number, required: true },
  },
  { _id: false },
);

const sensitiveHitSchema = new Schema(
  {
    class: { type: String, enum: SENSITIVE_CLASSES, required: true },
    count: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const aiEventSchema = new Schema(
  {
    uploadId: { type: Schema.Types.ObjectId, ref: 'Upload', required: true },
    actor: { type: String, required: true, maxlength: 190, default: 'unknown' },
    actorHash: { type: String, required: true, maxlength: 64 },
    host: { type: String, required: true, maxlength: 253 },
    path: { type: String, required: true, maxlength: 512, default: '/' },
    occurredAt: { type: Date, required: true },

    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', default: null },
    providerKey: { type: String, default: null, maxlength: 64 },
    providerName: { type: String, default: null, maxlength: 120 },
    providerCategory: { type: String, enum: PROVIDER_CATEGORIES, default: null },
    // Which detection path produced the match: registry lookup or a heuristic id.
    detectionSource: { type: String, required: true, default: 'registry', maxlength: 40 },

    policy: { type: String, enum: POLICY_STATUSES, required: true, default: 'unknown' },
    riskScore: { type: Number, required: true, default: 0, min: 0 },
    riskBand: { type: String, enum: RISK_BANDS, required: true, default: 'low' },
    riskFactors: { type: [riskFactorSchema], default: [] },
    sensitiveHits: { type: [sensitiveHitSchema], default: [] },
  },
  { timestamps: true },
);

// Index strategy - every one of these backs a query the product actually runs.
aiEventSchema.index({ occurredAt: -1 });
aiEventSchema.index({ policy: 1, occurredAt: -1 });
aiEventSchema.index({ providerKey: 1, occurredAt: -1 });
aiEventSchema.index({ actorHash: 1, occurredAt: -1 });
aiEventSchema.index({ uploadId: 1 });
aiEventSchema.index({ riskScore: -1 });
// Text-free prefix search on host and actor, used by the events table search box.
aiEventSchema.index({ host: 1 });

export type AiEventAttrs = InferSchemaType<typeof aiEventSchema>;

export type AiEventDoc = HydratedDocument<AiEventAttrs>;

export const AiEvent = model('AiEvent', aiEventSchema);
