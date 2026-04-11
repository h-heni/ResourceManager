import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummyExpenses, dummyExpenseSummary } from '../services/dummyData';

export function useExpenses(page: number = 1, size: number = 20) {
    return useQuery({
        queryKey: ['expenses', page, size],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 300));
                const start = (page - 1) * size;
                const sliced = dummyExpenses.slice(start, start + size);
                return {
                    data: sliced,
                    totalCount: dummyExpenses.length,
                    totalPages: Math.ceil(dummyExpenses.length / size),
                };
            }

            const res = await api.get('/Expenses', { params: { page, size } });
            return res.data;
        },
    });
}

export function useExpenseSummary() {
    return useQuery({
        queryKey: ['expenseSummary'],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 200));
                return dummyExpenseSummary;
            }
            const res = await api.get('/Expenses/summary');
            return res.data;
        },
    });
}

export function useSaveExpense() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id?: number; data: Record<string, unknown> }) => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return { success: true };
            }
            if (id) {
                return api.put(`/Expenses/${id}`, data);
            }
            return api.post('/Expenses', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}

export function useDeleteExpense() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return { success: true };
            }
            return api.delete(`/Expenses/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}
