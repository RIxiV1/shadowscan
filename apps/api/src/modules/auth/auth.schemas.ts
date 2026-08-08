import { z } from 'zod';

// Password policy: length over composition.
const password = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(200, 'Password must be at most 200 characters.');

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  // Not validated against the policy: an existing account may predate a policy
  // change, and echoing policy rules on the login form leaks them to an attacker.
  password: z.string().min(1, 'Password is required.').max(200),
});

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  password,
  role: z.enum(['admin', 'analyst']).optional(),
  bootstrapToken: z.string().max(200).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.').max(200),
    newPassword: password,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'The new password must be different from the current one.',
    path: ['newPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
