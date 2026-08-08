import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { RISK_DEFAULTS } from '../config/risk-defaults.js';

// risksettings - a singleton document holding the risk engine's tunable weights.
const riskSettingsSchema = new Schema(
  {
    singleton: { type: String, required: true, unique: true, default: 'global', enum: ['global'] },

    unknownProviderWeight: {
      type: Number,
      required: true,
      default: RISK_DEFAULTS.unknownProviderWeight,
      min: 0,
      max: 50,
    },
    blockedProviderMultiplier: {
      type: Number,
      required: true,
      default: RISK_DEFAULTS.blockedProviderMultiplier,
      min: 1,
      max: 10,
    },
    sensitiveKeywordWeight: {
      type: Number,
      required: true,
      default: RISK_DEFAULTS.sensitiveKeywordWeight,
      min: 0,
      max: 100,
    },
    sensitiveIdentifierWeight: {
      type: Number,
      required: true,
      default: RISK_DEFAULTS.sensitiveIdentifierWeight,
      min: 0,
      max: 100,
    },
    offHoursWeight: {
      type: Number,
      required: true,
      default: RISK_DEFAULTS.offHoursWeight,
      min: 0,
      max: 20,
    },
    offHoursStart: {
      type: Number,
      required: true,
      default: RISK_DEFAULTS.offHoursStart,
      min: 0,
      max: 23,
    },
    offHoursEnd: {
      type: Number,
      required: true,
      default: RISK_DEFAULTS.offHoursEnd,
      min: 0,
      max: 23,
    },
    confidentialKeywords: {
      type: [String],
      required: true,
      default: () => [...RISK_DEFAULTS.confidentialKeywords],
      validate: {
        validator: (values: string[]) => values.length <= 200,
        message: 'At most 200 confidential keywords are supported.',
      },
    },
    actorSaturationScore: {
      type: Number,
      required: true,
      default: RISK_DEFAULTS.actorSaturationScore,
      min: 10,
      max: 10_000,
    },
  },
  { timestamps: true },
);

export type RiskSettingsAttrs = InferSchemaType<typeof riskSettingsSchema>;

export type RiskSettingsDoc = HydratedDocument<RiskSettingsAttrs>;

export const RiskSettings = model('RiskSettings', riskSettingsSchema);

// Reads the singleton, creating it from defaults on first call.
export async function getRiskSettings(): Promise<RiskSettingsDoc> {
  const existing = await RiskSettings.findOne({ singleton: 'global' });
  if (existing) return existing;
  return RiskSettings.create({ singleton: 'global' });
}
