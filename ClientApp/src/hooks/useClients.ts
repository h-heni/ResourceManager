import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

interface PaginatedResult<T> {
    data: T[];
    totalCount: number;
    totalPages: number;
}

export function useClients(page: number, size: number) {
    return useQuery<PaginatedResult<unknown>>({
        queryKey: ['clients', page, size],
        queryFn: async () => {
            const res = await api.get(`/Clients?page=${page}&size=${size}`);
            const d = res.data;
            return { data: d.data || [], totalCount: d.totalCount || 0, totalPages: d.totalPages || 0 };
        },
    });
}

export function useSaveClient() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (params: { id?: number; data: Record<string, unknown> }) => {
            if (params.id) {
                return api.put(`/Clients/${params.id}`, { ...params.data, id: params.id });
            }
            return api.post('/Clients', params.data);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['clients'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}

export function useDeleteClient() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => api.delete(`/Clients/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['clients'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}
