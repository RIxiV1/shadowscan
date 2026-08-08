import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { POLICY_STATUSES, PROVIDER_CATEGORIES } from '@shadowscan/shared';

// providers - the AI registry *and* the organisation's policy for each entry.
const providerSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 64 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    vendor: { type: String, required: true, trim: true, maxlength: 120, default: 'Unknown' },
    category: { type: String, enum: PROVIDER_CATEGORIES, required: true, default: 'other' },
    domains: {
      type: [String],
      required: true,
      default: [],
      validate: {
        validator: (values: string[]) => values.length > 0 && values.length <= 50,
        message: 'A provider must have between 1 and 50 domains.',
      },
    },
    riskWeight: { type: Number, required: true, default: 2, min: 0, max: 20 },
    policy: { type: String, enum: POLICY_STATUSES, required: true, default: 'unknown' },
    dataRegion: { type: String, required: true, default: 'unknown', maxlength: 16 },
    trainsOnUserData: { type: Boolean, required: true, default: false },
    isBuiltIn: { type: Boolean, required: true, default: false },
    notes: { type: String, default: '', maxlength: 500 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// Multikey index over the domains array: this is the hot path during ingestion.
providerSchema.index({ domains: 1 });
providerSchema.index({ policy: 1, category: 1 });

export type ProviderAttrs = InferSchemaType<typeof providerSchema>;

export type ProviderDoc = HydratedDocument<ProviderAttrs>;

export const Provider = model('Provider', providerSchema);
