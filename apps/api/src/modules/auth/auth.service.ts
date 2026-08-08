import type { LoginResponse, UserDto } from '@shadowscan/shared';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { toUserDto } from '../../lib/mappers.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../../lib/passwords.js';
import { signAccessToken } from '../../lib/tokens.js';
import { User, type UserDoc } from '../../models/User.js';
import type { ChangePasswordInput, LoginInput, RegisterInput } from './auth.schemas.js';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export interface LoginOutcome extends LoginResponse {
  userDoc: UserDoc;
}

export async function login(input: LoginInput): Promise<LoginOutcome> {
  const user = await User.findOne({ email: input.email }).select(
    '+passwordHash email name role tokenVersion lastLoginAt failedLoginCount lockedUntil createdAt',
  );

  if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new AppError(
      423,
      'FORBIDDEN',
      `This account is temporarily locked after repeated failed sign-ins. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    );
  }

  // Always run a bcrypt comparison, even with no matching account, so the
  // response time does not distinguish "no such user" from "wrong password".
  const matches = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !matches) {
    if (user) await registerFailure(user);
    throw AppError.invalidCredentials();
  }

  user.failedLoginCount = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  const { token, expiresIn } = signAccessToken({
    sub: user.id as string,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  return { accessToken: token, expiresIn, user: toUserDto(user), userDoc: user };
}

async function registerFailure(user: UserDoc): Promise<void> {
  user.failedLoginCount += 1;
  if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
    user.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
    user.failedLoginCount = 0;
  }
  await user.save();
}

export interface RegisterContext {
  // Role of the caller, or `null` for an unauthenticated bootstrap attempt.
  callerRole: 'admin' | 'analyst' | null;
  bootstrapToken?: string;
}

export async function register(input: RegisterInput, context: RegisterContext): Promise<UserDto> {
  const userCount = await User.estimatedDocumentCount();
  const isBootstrap = userCount === 0;

  if (isBootstrap) {
    if (!env.BOOTSTRAP_TOKEN) {
      throw AppError.forbidden(
        'Bootstrap registration is disabled because BOOTSTRAP_TOKEN is not configured on the server.',
      );
    }
    if (context.bootstrapToken !== env.BOOTSTRAP_TOKEN) {
      throw AppError.forbidden('The bootstrap token is missing or incorrect.');
    }
  } else if (context.callerRole !== 'admin') {
    throw AppError.forbidden('Only an administrator can create additional accounts.');
  }

  const existing = await User.findOne({ email: input.email }).select('_id');
  if (existing) throw AppError.conflict('An account with that email already exists.');

  const user = await User.create({
    email: input.email,
    name: input.name,
    passwordHash: await hashPassword(input.password),
    // The bootstrap account is always an admin; there is nobody else to grant it.
    role: isBootstrap ? 'admin' : (input.role ?? 'analyst'),
  });

  return toUserDto(user);
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash tokenVersion');
  if (!user) throw AppError.notFound('Account');

  const matches = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!matches) throw AppError.badRequest('The current password is incorrect.');

  user.passwordHash = await hashPassword(input.newPassword);
  // Invalidates every JWT already issued to this user, including any an attacker
  // holds. This is the whole reason `tokenVersion` exists.
  user.tokenVersion += 1;
  await user.save();
}

export async function getProfile(userId: string): Promise<UserDto> {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('Account');
  return toUserDto(user);
}

// Used by the login page to decide whether to offer the bootstrap form.
export async function needsBootstrap(): Promise<boolean> {
  return (await User.estimatedDocumentCount()) === 0;
}
