import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummySupplierInvoices } from '../services/dummyData';

export function useSupplierInvoices() {
    return useQuery({
        queryKey: ['supplierInvoices'],
        queryFn: async () => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 300));
                return dummySupplierInvoices;
            }
            
            const res = await api.get('/SupplierInvoices');
            return res.data || [];
        },
    });
}

export function useDeleteSupplierInvoice() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            if (USE_DUMMY_DATA) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return { success: true };
            }
            return api.delete(`/SupplierInvoices/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supplierInvoices'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}
