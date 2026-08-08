import { Schema, model, type InferSchemaType } from 'mongoose';

// auditlogs - append-only record of security-relevant actions.
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorEmail: { type: String, required: true, default: 'anonymous', maxlength: 254 },
    action: { type: String, required: true, maxlength: 64 },
    target: { type: String, required: true, default: '', maxlength: 200 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, required: true, default: 'unknown', maxlength: 64 },
    createdAt: { type: Date, required: true, default: Date.now, expires: 60 * 60 * 24 * 365 },
  },
  { versionKey: false },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export type AuditLogAttrs = InferSchemaType<typeof auditLogSchema>;

export const AuditLog = model('AuditLog', auditLogSchema);

// Derived from the model rather than written as `HydratedDocument<AuditLogAttrs>`:
// this schema sets `versionKey: false`, and that option is part of the document
// type Mongoose produces. Deriving keeps the mapper signature in step with it.
export type AuditLogDoc = InstanceType<typeof AuditLog>;
