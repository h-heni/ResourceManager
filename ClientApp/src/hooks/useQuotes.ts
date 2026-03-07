import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function useQuotes() {
    return useQuery<unknown[]>({
        queryKey: ['quotes'],
        queryFn: async () => {
            const res = await api.get('/Quotes?includeItems=true');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            return data;
        },
    });
}

export function useDeleteQuote() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => api.delete(`/Quotes/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['quotes'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['invoices'] });
        },
    });
}
