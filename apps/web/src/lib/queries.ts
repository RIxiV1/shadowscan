import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  AuditLogDto,
  DashboardSummary,
  EventListQuery,
  EventListResult,
  Paginated,
  PolicyStatus,
  ProviderDto,
  ProviderListQuery,
  RiskReportDto,
  RiskSettingsDto,
  UpdateRiskSettingsRequest,
  UploadDto,
  UploadResult,
  UpsertProviderRequest,
} from '@shadowscan/shared';
import { apiRequest, apiUpload } from './api-client';

// Server state lives in React Query; the app holds almost no local copies.
export const queryKeys = {
  dashboard: (days: number) => ['dashboard', days] as const,
  uploads: (page: number) => ['uploads', page] as const,
  events: (filters: EventListQuery) => ['events', filters] as const,
  providers: (filters: ProviderListQuery) => ['providers', filters] as const,
  riskSettings: () => ['risk-settings'] as const,
  reports: (page: number) => ['reports', page] as const,
  report: (id: string) => ['report', id] as const,
  audit: (page: number) => ['audit', page] as const,
};

export function useDashboard(days: number): UseQueryResult<DashboardSummary> {
  return useQuery({
    queryKey: queryKeys.dashboard(days),
    queryFn: () => apiRequest<DashboardSummary>('/analytics/dashboard', { query: { days } }),
    // The underlying data only changes on upload, and uploads invalidate this
    // key explicitly. A short stale time avoids refetching on every tab focus.
    staleTime: 60_000,
  });
}

export function useUploads(page: number): UseQueryResult<Paginated<UploadDto>> {
  return useQuery({
    queryKey: queryKeys.uploads(page),
    queryFn: () => apiRequest<Paginated<UploadDto>>('/uploads', { query: { page, pageSize: 20 } }),
  });
}

export function useCreateUpload() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => apiUpload<UploadResult>('/uploads', file),
    onSuccess: () => {
      // Ingestion changes every derived view at once.
      void client.invalidateQueries({ queryKey: ['dashboard'] });
      void client.invalidateQueries({ queryKey: ['uploads'] });
      void client.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useDeleteUpload() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<{ deletedEvents: number }>(`/uploads/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['dashboard'] });
      void client.invalidateQueries({ queryKey: ['uploads'] });
      void client.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// --------------------------------------------------------------- events ---

export function useEvents(filters: EventListQuery): UseQueryResult<EventListResult> {
  return useQuery({
    queryKey: queryKeys.events(filters),
    queryFn: () =>
      apiRequest<EventListResult>('/events', {
        query: filters as Record<string, string | number | undefined>,
      }),
    // Keeps the previous page on screen while the next one loads, so the table
    // does not collapse to a spinner on every pagination click.
    placeholderData: (previous) => previous,
  });
}

// ------------------------------------------------------------ providers ---

export function useProviders(filters: ProviderListQuery): UseQueryResult<ProviderDto[]> {
  return useQuery({
    queryKey: queryKeys.providers(filters),
    queryFn: () =>
      apiRequest<ProviderDto[]>('/providers', {
        query: filters as Record<string, string | undefined>,
      }),
  });
}

export function useUpdateProviderPolicy() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, policy }: { id: string; policy: PolicyStatus }) =>
      apiRequest<ProviderDto>(`/providers/${id}/policy`, { method: 'PATCH', body: { policy } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['providers'] });
      // Policy affects how future ingestion classifies traffic, and the
      // dashboard legend labels tools by their current policy.
      void client.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateProvider() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertProviderRequest) =>
      apiRequest<ProviderDto>('/providers', { method: 'POST', body: input }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['providers'] }),
  });
}

export function useUpdateProvider() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpsertProviderRequest }) =>
      apiRequest<ProviderDto>(`/providers/${id}`, { method: 'PUT', body: input }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['providers'] }),
  });
}

export function useDeleteProvider() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/providers/${id}`, { method: 'DELETE' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['providers'] }),
  });
}

// ------------------------------------------------------------- settings ---

export function useRiskSettings(): UseQueryResult<RiskSettingsDto> {
  return useQuery({
    queryKey: queryKeys.riskSettings(),
    queryFn: () => apiRequest<RiskSettingsDto>('/settings/risk'),
  });
}

export function useUpdateRiskSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateRiskSettingsRequest) =>
      apiRequest<RiskSettingsDto>('/settings/risk', { method: 'PATCH', body: input }),
    onSuccess: (data) => client.setQueryData(queryKeys.riskSettings(), data),
  });
}

export function useReports(page: number): UseQueryResult<Paginated<RiskReportDto>> {
  return useQuery({
    queryKey: queryKeys.reports(page),
    queryFn: () => apiRequest<Paginated<RiskReportDto>>('/reports', { query: { page, pageSize: 20 } }),
  });
}

export function useReport(id: string | undefined): UseQueryResult<RiskReportDto> {
  return useQuery({
    queryKey: queryKeys.report(id ?? ''),
    queryFn: () => apiRequest<RiskReportDto>(`/reports/${id}`),
    enabled: Boolean(id),
  });
}

export function useGenerateReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string; from?: string; to?: string }) =>
      apiRequest<RiskReportDto>('/reports', { method: 'POST', body: input }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function useDeleteReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/reports/${id}`, { method: 'DELETE' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function useAuditLog(page: number): UseQueryResult<Paginated<AuditLogDto>> {
  return useQuery({
    queryKey: queryKeys.audit(page),
    queryFn: () => apiRequest<Paginated<AuditLogDto>>('/audit', { query: { page, pageSize: 50 } }),
  });
}
