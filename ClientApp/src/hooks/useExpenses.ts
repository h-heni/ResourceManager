import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

interface PaginatedResult<T> {
    data: T[];
    totalCount: number;
    totalPages: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useExpenses(page: number, size: number) {
    return useQuery<PaginatedResult<any>>({
        queryKey: ['expenses', page, size],
        queryFn: async () => {
            const res = await api.get(`/Expenses?page=${page}&size=${size}`);
            const d = res.data;
            return { data: d.data || [], totalCount: d.totalCount || 0, totalPages: d.totalPages || 0 };
        },
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useExpenseSummary() {
    return useQuery<any>({
        queryKey: ['expenses', 'summary'],
        queryFn: async () => {
            const res = await api.get('/Expenses/summary');
            return res.data;
        },
    });
}

export function useSaveExpense() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (params: { id?: number; data: Record<string, unknown> }) => {
            if (params.id) {
                return api.put(`/Expenses/${params.id}`, params.data);
            }
            return api.post('/Expenses', params.data);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}

export function useDeleteExpense() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => api.delete(`/Expenses/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}
