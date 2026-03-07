import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function useSuppliers() {
    return useQuery<unknown[]>({
        queryKey: ['suppliers'],
        queryFn: async () => {
            const res = await api.get('/Suppliers');
            return Array.isArray(res.data) ? res.data : (res.data.data || []);
        },
    });
}

export function useSaveSupplier() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (params: { id?: number; data: Record<string, unknown> }) => {
            if (params.id) {
                return api.put(`/Suppliers/${params.id}`, { ...params.data, id: params.id });
            }
            return api.post('/Suppliers', params.data);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['suppliers'] });
            qc.invalidateQueries({ queryKey: ['suppliers-lookup'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}

export function useDeleteSupplier() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => api.delete(`/Suppliers/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['suppliers'] });
            qc.invalidateQueries({ queryKey: ['suppliers-lookup'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}
