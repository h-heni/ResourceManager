import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function useDeliveryNotes() {
    return useQuery<unknown[]>({
        queryKey: ['deliveryNotes'],
        queryFn: async () => {
            const res = await api.get('/DeliveryNotes');
            return Array.isArray(res.data) ? res.data : (res.data.data || []);
        },
    });
}

export function useDeleteDeliveryNote() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => api.delete(`/DeliveryNotes/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['deliveryNotes'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}
