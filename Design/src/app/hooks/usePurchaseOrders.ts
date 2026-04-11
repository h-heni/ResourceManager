import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummyPurchaseOrders } from '../services/dummyData';

export function usePurchaseOrders() {
    return useQuery({
        queryKey: ['purchaseOrders'],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 300));
                return dummyPurchaseOrders;
            }
            
            const res = await api.get('/Inventory/purchase-orders');
            return res.data || [];
        },
    });
}

export function useDeletePurchaseOrder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return { success: true };
            }
            return api.delete(`/Inventory/purchase-orders/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}
