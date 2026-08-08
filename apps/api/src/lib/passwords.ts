import bcrypt from 'bcryptjs';

/**
 * Password hashing.
 *
 * bcrypt at cost 12: roughly 250 ms per hash on Render's free tier, which is slow
 * enough to make offline cracking expensive and fast enough that a login does not
 * feel broken. `bcryptjs` (pure JS) rather than the native `bcrypt` binding - 
 * native builds are the single most common cause of a failed deploy on hosts
 * without a build toolchain, and the throughput difference is irrelevant at the
 * handful of logins per day this product sees.
 */
const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A dummy hash of a random value, compared against when no user matches during
 * login. Without it, a missing account returns in ~1 ms and a real account in
 * ~250 ms, and that timing difference alone enumerates valid email addresses.
 */
export const DUMMY_HASH = bcrypt.hashSync('shadowscan-timing-equaliser', COST);
