import { z } from 'zod';
import { POLICY_STATUSES, PROVIDER_CATEGORIES } from '@shadowscan/shared';

// Domain validation is stricter than "contains a dot".
const domain = z
  .string()
  .trim()
  .toLowerCase()
  .min(4)
  .max(253)
  .regex(
    /^(?!-)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
    'Enter a bare hostname such as example.com — no scheme, port or path.',
  );

export const upsertProviderSchema = z.object({
  name: z.string().trim().min(2).max(120),
  vendor: z.string().trim().min(1).max(120).default('Unknown'),
  category: z.enum(PROVIDER_CATEGORIES),
  domains: z.array(domain).min(1, 'Add at least one domain.').max(50),
  riskWeight: z.number().min(0).max(20),
  policy: z.enum(POLICY_STATUSES),
  dataRegion: z
    .string()
    .trim()
    .max(16)
    .default('unknown')
    .transform((value) => (value === '' ? 'unknown' : value)),
  trainsOnUserData: z.boolean().default(false),
  notes: z.string().trim().max(500).default(''),
});

export const updatePolicySchema = z.object({
  policy: z.enum(POLICY_STATUSES),
});

export const listProvidersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  policy: z.enum(POLICY_STATUSES).optional(),
  category: z.enum(PROVIDER_CATEGORIES).optional(),
});

export type UpsertProviderInput = z.infer<typeof upsertProviderSchema>;

export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;

export type ListProvidersInput = z.infer<typeof listProvidersSchema>;
