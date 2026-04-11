import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummyProducts } from '../services/dummyData';

interface PaginatedResult<T> {
    data: T[];
    totalCount: number;
    totalPages: number;
}

export function useProductServices(page: number, size: number) {
    return useQuery<PaginatedResult<unknown>>({
        queryKey: ['productServices', page, size],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 300));
                const start = (page - 1) * size;
                const end = start + size;
                const paginated = dummyProducts.slice(start, end);
                return {
                    data: paginated,
                    totalCount: dummyProducts.length,
                    totalPages: Math.ceil(dummyProducts.length / size),
                };
            }
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
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return { data: { id: params.id || Date.now(), ...params.data } };
            }
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
        mutationFn: async (id: number) => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return { data: { success: true } };
            }
            return api.delete(`/ProductServices/${id}`);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['productServices'] });
            qc.invalidateQueries({ queryKey: ['products-lookup'] });
            qc.invalidateQueries({ queryKey: ['inventory'] });
        },
    });
}
