import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ROLES } from '@shadowscan/shared';

// users - operator accounts for the console.
const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'analyst' },
    tokenVersion: { type: Number, required: true, default: 0 },
    lastLoginAt: { type: Date, default: null },
    failedLoginCount: { type: Number, required: true, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  {
    timestamps: true,
    // Strip the hash and internal counters from anything that is accidentally
    // serialised. Defence in depth behind the explicit DTO mappers.
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.failedLoginCount;
        delete ret.lockedUntil;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type UserAttrs = InferSchemaType<typeof userSchema>;

export type UserDoc = HydratedDocument<UserAttrs>;

export const User = model('User', userSchema);
