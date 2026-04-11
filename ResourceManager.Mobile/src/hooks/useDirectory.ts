import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi, type SaveClientRequest } from '../api/clients';
import { productsApi, type SaveProductRequest } from '../api/products';
import { inventoryApi } from '../api/inventory';

export function useClients(page = 1, size = 20) {
  return useQuery({
    queryKey: ['clients', page, size],
    queryFn: () => clientsApi.list(page, size),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveClientRequest) => clientsApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveClientRequest }) => clientsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => clientsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); },
  });
}

export function useProductServices(page = 1, size = 20) {
  return useQuery({
    queryKey: ['products', page, size],
    queryFn: () => productsApi.list(page, size),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveProductRequest) => productsApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveProductRequest }) => productsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => productsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); },
  });
}

export function useStockLevels(search?: string, status?: string) {
  return useQuery({
    queryKey: ['stock-levels', search, status],
    queryFn: () => inventoryApi.getStockLevels(1, 100, search, status),
  });
}

export function useStockAlerts() {
  return useQuery({
    queryKey: ['stock-alerts'],
    queryFn: () => inventoryApi.getStockAlerts(),
  });
}
