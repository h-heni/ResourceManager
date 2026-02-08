import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// Types
export interface Fournisseur {
    id: number;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    ice?: string;
}

export interface FournisseurInvoice {
    id: number;
    fournisseurId: number;
    fileName: string;
    fileUrl: string;
    uploadedAt: string;
    amount?: number;
    description?: string;
}

export interface CreateFournisseurRequest {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    ice?: string;
}

export interface UpdateFournisseurRequest extends CreateFournisseurRequest {
    id: number;
}

export interface UploadFournisseurInvoiceRequest {
    fournisseurId: number;
    file: File;
    amount?: number;
    description?: string;
}

// Query Keys
export const fournisseurKeys = {
    all: ['fournisseurs'] as const,
    lists: () => [...fournisseurKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...fournisseurKeys.lists(), filters] as const,
    details: () => [...fournisseurKeys.all, 'detail'] as const,
    detail: (id: number) => [...fournisseurKeys.details(), id] as const,
    invoices: (id: number) => [...fournisseurKeys.detail(id), 'invoices'] as const,
};

// Hooks
export function useFournisseurs() {
    return useQuery({
        queryKey: fournisseurKeys.lists(),
        queryFn: async () => {
            const res = await api.get('/Fournisseurs');
            return Array.isArray(res.data) ? res.data : (res.data.data || []) as Fournisseur[];
        },
    });
}

export function useFournisseur(id: number) {
    return useQuery({
        queryKey: fournisseurKeys.detail(id),
        queryFn: async () => {
            const res = await api.get(`/Fournisseurs/${id}`);
            return res.data as Fournisseur;
        },
        enabled: !!id,
    });
}

export function useCreateFournisseur() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateFournisseurRequest) => {
            const res = await api.post('/Fournisseurs', data);
            return res.data as Fournisseur;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: fournisseurKeys.all });
        },
    });
}

export function useUpdateFournisseur() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: UpdateFournisseurRequest) => {
            const res = await api.put(`/Fournisseurs/${data.id}`, data);
            return res.data as Fournisseur;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: fournisseurKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: fournisseurKeys.lists() });
        },
    });
}

export function useDeleteFournisseur() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/Fournisseurs/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: fournisseurKeys.all });
        },
    });
}

export function useFournisseurInvoices(fournisseurId: number) {
    return useQuery({
        queryKey: fournisseurKeys.invoices(fournisseurId),
        queryFn: async () => {
            const res = await api.get(`/Fournisseurs/${fournisseurId}/invoices`);
            return res.data as FournisseurInvoice[];
        },
        enabled: !!fournisseurId,
    });
}

export function useUploadFournisseurInvoice() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: UploadFournisseurInvoiceRequest) => {
            const formData = new FormData();
            formData.append('file', data.file);
            if (data.amount) formData.append('amount', data.amount.toString());
            if (data.description) formData.append('description', data.description);

            const res = await api.post(`/Fournisseurs/${data.fournisseurId}/invoices`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data as FournisseurInvoice;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: fournisseurKeys.invoices(variables.fournisseurId) });
        },
    });
}

export function useDeleteFournisseurInvoice() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ fournisseurId, invoiceId }: { fournisseurId: number; invoiceId: number }) => {
            await api.delete(`/Fournisseurs/${fournisseurId}/invoices/${invoiceId}`);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: fournisseurKeys.invoices(variables.fournisseurId) });
        },
    });
}
