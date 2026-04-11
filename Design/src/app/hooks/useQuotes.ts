import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummyQuotes } from '../services/dummyData';

export function useQuotes() {
    return useQuery({
        queryKey: ['quotes'],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 300));
                return dummyQuotes;
            }
            
            const res = await api.get('/Quotes');
            return res.data || [];
        },
    });
}

export function useDeleteQuote() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return { success: true };
            }
            return api.delete(`/Quotes/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}
