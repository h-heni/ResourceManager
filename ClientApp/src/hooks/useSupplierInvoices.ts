import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

interface PaginatedResult<T> {
    data: T[];
    totalCount: number;
}

export function useSupplierInvoices(page: number, size: number, status: string, search: string, year?: number | null, enabled = true) {
    return useQuery<PaginatedResult<unknown>>({
        queryKey: ['supplierInvoices', status, page, size, search, year],
        queryFn: async () => {
            const params: Record<string, unknown> = { page, size, status, search };
            if (year != null) params.year = year;
            const res = await api.get('/SupplierInvoices', { params });
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            return { data, totalCount: res.data.totalCount ?? data.length ?? 0 };
        },
        enabled,
    });
}

export function useDeleteSupplierInvoice() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => api.delete(`/SupplierInvoices/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['supplierInvoices'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}
