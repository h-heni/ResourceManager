import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// Types
export interface Devis {
    id: number;
    number: number;
    date: string;
    totalAmount: number;
    clientId: number;
    clientName: string;
    status: string;
    validUntil?: string;
    items?: DevisItem[];
}

export interface DevisItem {
    id: number;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface DevisListDto {
    id: number;
    number: number;
    date: string;
    totalAmount: number;
    clientName: string;
    status: string;
    validUntil?: string;
}

export interface CreateDevisRequest {
    clientId: number;
    date: string;
    validUntil?: string;
    items: CreateDevisItemRequest[];
}

export interface CreateDevisItemRequest {
    description: string;
    quantity: number;
    unitPrice: number;
}

export interface UpdateDevisRequest extends CreateDevisRequest {
    id: number;
}

// Query Keys
export const devisKeys = {
    all: ['devis'] as const,
    lists: () => [...devisKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...devisKeys.lists(), filters] as const,
    details: () => [...devisKeys.all, 'detail'] as const,
    detail: (id: number) => [...devisKeys.details(), id] as const,
};

// Hooks
export function useDevisList() {
    return useQuery({
        queryKey: devisKeys.lists(),
        queryFn: async () => {
            const res = await api.get('/Devis');
            return Array.isArray(res.data) ? res.data : (res.data.data || []) as DevisListDto[];
        },
    });
}

export function useDevis(id: number) {
    return useQuery({
        queryKey: devisKeys.detail(id),
        queryFn: async () => {
            const res = await api.get(`/Devis/${id}`);
            return res.data as Devis;
        },
        enabled: !!id,
    });
}

export function useCreateDevis() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateDevisRequest) => {
            const res = await api.post('/Devis', data);
            return res.data as Devis;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: devisKeys.all });
        },
    });
}

export function useUpdateDevis() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: UpdateDevisRequest) => {
            const res = await api.put(`/Devis/${data.id}`, data);
            return res.data as Devis;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: devisKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: devisKeys.lists() });
        },
    });
}

export function useDeleteDevis() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/Devis/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: devisKeys.all });
        },
    });
}

export function useDownloadDevisPdf() {
    return useMutation({
        mutationFn: async ({ id, number }: { id: number; number: string | number }) => {
            const res = await api.get(`/Devis/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Devis_${number}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        },
    });
}

export function useConvertDevisToInvoice() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            const res = await api.post(`/Devis/${id}/convert-to-invoice`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: devisKeys.all });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
    });
}
