import { useQuery } from '@tanstack/react-query';
import { dashboardApi, type RevenueSummaryResponse, type PurchasesSummaryResponse, type TopClient } from '../api/dashboard';

export function useDashboardStats(year?: number, currency?: string) {
  return useQuery({
    queryKey: ['dashboard-stats', year, currency],
    queryFn: () => dashboardApi.getStats(year, currency),
  });
}

export function useRevenueSummary(year?: number, currency?: string) {
  return useQuery<RevenueSummaryResponse>({
    queryKey: ['revenue-summary', year, currency],
    queryFn: () => dashboardApi.getRevenueSummary(year, currency),
  });
}

export function usePurchasesSummary(year?: number, currency?: string) {
  return useQuery<PurchasesSummaryResponse>({
    queryKey: ['purchases-summary', year, currency],
    queryFn: () => dashboardApi.getPurchasesSummary(year, currency),
  });
}

export function useTopClients(year?: number, currency?: string) {
  return useQuery<TopClient[]>({
    queryKey: ['top-clients', year, currency],
    queryFn: () => dashboardApi.getTopClients(year, currency),
  });
}
