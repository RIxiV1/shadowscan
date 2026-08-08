import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { SOURCE_FORMATS, UPLOAD_STATUSES } from '@shadowscan/shared';

// uploads - one document per ingested log file (the batch, not the rows).
const uploadSchema = new Schema(
  {
    filename: { type: String, required: true, maxlength: 255 },
    sizeBytes: { type: Number, required: true, min: 0 },
    checksum: { type: String, required: true, index: true, maxlength: 64 },
    format: { type: String, enum: SOURCE_FORMATS, required: true },
    status: { type: String, enum: UPLOAD_STATUSES, required: true, default: 'pending' },
    rowsTotal: { type: Number, required: true, default: 0 },
    rowsParsed: { type: Number, required: true, default: 0 },
    rowsRejected: { type: Number, required: true, default: 0 },
    aiRequests: { type: Number, required: true, default: 0 },
    shadowAiRequests: { type: Number, required: true, default: 0 },
    parseErrors: { type: [String], default: [] },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

uploadSchema.index({ createdAt: -1 });

export type UploadAttrs = InferSchemaType<typeof uploadSchema>;

export type UploadDoc = HydratedDocument<UploadAttrs>;

export const Upload = model('Upload', uploadSchema);
