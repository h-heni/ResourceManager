import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

interface PaginatedResult<T> {
    data: T[];
    totalCount: number;
    totalPages: number;
}

export function useProductServices(page: number, size: number) {
    return useQuery<PaginatedResult<unknown>>({
        queryKey: ['productServices', page, size],
        queryFn: async () => {
            const res = await api.get(`/ProductServices?page=${page}&size=${size}`);
            const d = res.data;
            return { data: d.data || [], totalCount: d.totalCount || 0, totalPages: d.totalPages || 0 };
        },
    });
}

export function useSaveProductService() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (params: { id?: number; data: Record<string, unknown> }) => {
            if (params.id) {
                return api.put(`/ProductServices/${params.id}`, params.data);
            }
            return api.post('/ProductServices', params.data);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['productServices'] });
            qc.invalidateQueries({ queryKey: ['products-lookup'] });
            qc.invalidateQueries({ queryKey: ['inventory'] });
        },
    });
}

export function useDeleteProductService() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => api.delete(`/ProductServices/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['productServices'] });
            qc.invalidateQueries({ queryKey: ['products-lookup'] });
            qc.invalidateQueries({ queryKey: ['inventory'] });
        },
    });
}
