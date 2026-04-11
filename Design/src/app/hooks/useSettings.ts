import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummySettings } from '../services/dummyData';

export function useSettings() {
    return useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 300));
                return dummySettings;
            }
            
            const res = await api.get('/Settings');
            return res.data || {};
        },
    });
}

export function useSaveSettings() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (settings: any) => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return { success: true };
            }
            return api.put('/Settings', settings);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });
}

export function invalidateSettingsCache() {
    // This function can be called from outside to invalidate the settings cache
    // For now it's a no-op, but kept for API compatibility
}
