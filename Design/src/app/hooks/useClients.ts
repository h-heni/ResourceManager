import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummyClients } from '../services/dummyData';

export function useClients(page: number = 1, pageSize: number = 20, search?: string) {
  return useQuery({
    queryKey: ['clients', page, pageSize, search],
    queryFn: async () => {
      if (USE_DUMMY_DATA) {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        let filtered = dummyClients;
        if (search) {
          const searchLower = search.toLowerCase();
          filtered = dummyClients.filter(client => 
            client.name.toLowerCase().includes(searchLower) ||
            client.email.toLowerCase().includes(searchLower)
          );
        }
        
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginated = filtered.slice(start, end);
        
        return {
          clients: paginated,
          totalCount: filtered.length,
          pageSize,
          currentPage: page,
        };
      }
      
      const response = await api.get('/clients', {
        params: { page, pageSize, search },
      });
      return response.data;
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      if (USE_DUMMY_DATA) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true };
      }
      const response = await api.delete(`/clients/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useSaveClient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (client: any) => {
      if (USE_DUMMY_DATA) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true, data: client };
      }
      
      if (client.id) {
        const response = await api.put(`/clients/${client.id}`, client);
        return response.data;
      } else {
        const response = await api.post('/clients', client);
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}