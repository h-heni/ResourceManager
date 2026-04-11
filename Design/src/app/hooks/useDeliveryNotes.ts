import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummyDeliveryNotes } from '../services/dummyData';

export function useDeliveryNotes() {
    return useQuery({
        queryKey: ['deliveryNotes'],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 300));
                return dummyDeliveryNotes;
            }
            
            const res = await api.get('/DeliveryNotes');
            return res.data || [];
        },
    });
}

export function useDeleteDeliveryNote() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return { success: true };
            }
            return api.delete(`/DeliveryNotes/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deliveryNotes'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}
