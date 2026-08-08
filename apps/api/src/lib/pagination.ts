import type { Paginated } from '@shadowscan/shared';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

export interface PageParams {
  page: number;
  pageSize: number;
  skip: number;
  limit: number;
}

// Normalises page inputs.
export function resolvePage(input: { page?: number; pageSize?: number }): PageParams {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE)));
  return { page, pageSize, skip: (page - 1) * pageSize, limit: pageSize };
}

export function paginate<T>(items: T[], total: number, params: PageParams): Paginated<T> {
  return {
    items,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}
