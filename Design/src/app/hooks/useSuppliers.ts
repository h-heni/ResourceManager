import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummySuppliers } from '../services/dummyData';

export function useSuppliers(page: number = 1, pageSize: number = 20, search?: string) {
  return useQuery({
    queryKey: ['suppliers', page, pageSize, search],
    queryFn: async () => {
      if (USE_DUMMY_DATA) {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        let filtered = dummySuppliers;
        if (search) {
          const searchLower = search.toLowerCase();
          filtered = dummySuppliers.filter(supplier => 
            supplier.name.toLowerCase().includes(searchLower) ||
            supplier.email.toLowerCase().includes(searchLower)
          );
        }
        
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginated = filtered.slice(start, end);
        
        return {
          suppliers: paginated,
          totalCount: filtered.length,
          pageSize,
          currentPage: page,
        };
      }
      
      const response = await api.get('/suppliers', {
        params: { page, pageSize, search },
      });
      return response.data;
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      if (USE_DUMMY_DATA) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true };
      }
      const response = await api.delete(`/suppliers/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useSaveSupplier() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (supplier: any) => {
      if (USE_DUMMY_DATA) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true, data: supplier };
      }
      
      if (supplier.id) {
        const response = await api.put(`/suppliers/${supplier.id}`, supplier);
        return response.data;
      } else {
        const response = await api.post('/suppliers', supplier);
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}