import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, type CompanySettings, type ChangePasswordRequest } from '../api/settings';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getBranding(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateBranding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CompanySettings>) => settingsApi.updateBranding(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => settingsApi.changePassword(data),
  });
}

export function useTestEmail() {
  return useMutation({
    mutationFn: () => settingsApi.testEmail(),
  });
}

export function useSetupCompany() {
  return useMutation({
    mutationFn: (data: { companyName: string; industry?: string; size?: string }) =>
      settingsApi.setupCompany(data),
  });
}
