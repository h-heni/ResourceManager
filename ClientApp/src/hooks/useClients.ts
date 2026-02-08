import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// Types
export interface Client {
    id: number;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    ice?: string;
}

export interface CreateClientRequest {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    ice?: string;
}

export interface UpdateClientRequest extends CreateClientRequest {
    id: number;
}

// Query Keys
export const clientKeys = {
    all: ['clients'] as const,
    lists: () => [...clientKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...clientKeys.lists(), filters] as const,
    details: () => [...clientKeys.all, 'detail'] as const,
    detail: (id: number) => [...clientKeys.details(), id] as const,
};

// Hooks
export function useClients() {
    return useQuery({
        queryKey: clientKeys.lists(),
        queryFn: async () => {
            const res = await api.get('/Clients');
            return Array.isArray(res.data) ? res.data : (res.data.data || []) as Client[];
        },
    });
}

export function useClient(id: number) {
    return useQuery({
        queryKey: clientKeys.detail(id),
        queryFn: async () => {
            const res = await api.get(`/Clients/${id}`);
            return res.data as Client;
        },
        enabled: !!id,
    });
}

export function useCreateClient() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateClientRequest) => {
            const res = await api.post('/Clients', data);
            return res.data as Client;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: clientKeys.all });
        },
    });
}

export function useUpdateClient() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: UpdateClientRequest) => {
            const res = await api.put(`/Clients/${data.id}`, data);
            return res.data as Client;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
        },
    });
}

export function useDeleteClient() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/Clients/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: clientKeys.all });
        },
    });
}
