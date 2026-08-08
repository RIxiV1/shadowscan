import type { FilterQuery } from 'mongoose';
import type { ProviderDto } from '@shadowscan/shared';
import { buildProviderIndex, type IndexedProvider, type ProviderIndex } from '../../engine/detector.js';
import { AppError } from '../../lib/errors.js';
import { toProviderDto } from '../../lib/mappers.js';
import { Provider, type ProviderAttrs } from '../../models/Provider.js';
import type { ListProvidersInput, UpsertProviderInput } from './providers.schemas.js';

// Escapes user input before it becomes part of a RegExp - prevents ReDoS and injection into the query.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listProviders(filters: ListProvidersInput): Promise<ProviderDto[]> {
  const query: FilterQuery<ProviderAttrs> = {};
  if (filters.policy) query.policy = filters.policy;
  if (filters.category) query.category = filters.category;
  if (filters.search) {
    const pattern = new RegExp(escapeRegex(filters.search), 'i');
    query.$or = [{ name: pattern }, { vendor: pattern }, { domains: pattern }];
  }

  const providers = await Provider.find(query).sort({ name: 1 }).limit(500);
  return providers.map(toProviderDto);
}

export async function createProvider(input: UpsertProviderInput, userId: string): Promise<ProviderDto> {
  const key = slugify(`${input.vendor}-${input.name}`);

  const clash = await Provider.findOne({
    $or: [{ key }, { domains: { $in: input.domains } }],
  }).select('key name domains');

  if (clash) {
    throw AppError.conflict(
      clash.key === key
        ? `A provider named "${input.name}" from ${input.vendor} already exists.`
        : `One of those domains is already registered to "${clash.name}".`,
    );
  }

  const provider = await Provider.create({
    ...input,
    key,
    isBuiltIn: false,
    updatedBy: userId,
  });

  return toProviderDto(provider);
}

export async function updateProvider(
  id: string,
  input: UpsertProviderInput,
  userId: string,
): Promise<ProviderDto> {
  const provider = await Provider.findById(id);
  if (!provider) throw AppError.notFound('Provider');

  // A domain may only belong to one provider, or detection becomes order-dependent.
  const clash = await Provider.findOne({
    _id: { $ne: provider._id },
    domains: { $in: input.domains },
  }).select('name');
  if (clash) {
    throw AppError.conflict(`One of those domains is already registered to "${clash.name}".`);
  }

  provider.set({ ...input, updatedBy: userId });
  await provider.save();
  return toProviderDto(provider);
}

export async function updateProviderPolicy(
  id: string,
  policy: ProviderDto['policy'],
  userId: string,
): Promise<ProviderDto> {
  const provider = await Provider.findById(id);
  if (!provider) throw AppError.notFound('Provider');

  provider.policy = policy;
  provider.updatedBy = userId as never;
  await provider.save();
  return toProviderDto(provider);
}

export async function deleteProvider(id: string): Promise<void> {
  const provider = await Provider.findById(id);
  if (!provider) throw AppError.notFound('Provider');

  // Built-in entries are re-created by the seeder on every deploy, so deleting one
  // produces a resurrection bug that looks like the policy silently reverting.
  // Blocking the delete and pointing at the policy field is the honest behaviour.
  if (provider.isBuiltIn) {
    throw AppError.forbidden(
      'Built-in providers cannot be deleted because the seeder would recreate them. Set the policy to "blocked" instead.',
    );
  }

  await provider.deleteOne();
}

export async function loadProviderIndex(): Promise<{ index: ProviderIndex; providers: IndexedProvider[] }> {
  const documents = await Provider.find()
    .select('key name vendor category domains riskWeight policy dataRegion trainsOnUserData')
    .lean();

  const providers: IndexedProvider[] = documents.map((document) => ({
    id: String(document._id),
    key: document.key,
    name: document.name,
    vendor: document.vendor,
    category: document.category,
    domains: document.domains,
    riskWeight: document.riskWeight,
    policy: document.policy,
    dataRegion: document.dataRegion,
    trainsOnUserData: document.trainsOnUserData,
  }));

  return { index: buildProviderIndex(providers), providers };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
