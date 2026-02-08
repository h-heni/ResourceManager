import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// Types
export interface Invoice {
    id: number;
    number: number;
    date: string;
    totalAmount: number;
    clientId: number;
    clientName: string;
    status: string;
    isLocked: boolean;
    treated: boolean;
    items?: InvoiceItem[];
}

export interface InvoiceItem {
    id: number;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface InvoiceListDto {
    id: number;
    number: number;
    date: string;
    totalAmount: number;
    clientName: string;
    status: string;
    isLocked: boolean;
    treated: boolean;
}

export interface CreateInvoiceRequest {
    clientId: number;
    date: string;
    items: CreateInvoiceItemRequest[];
}

export interface CreateInvoiceItemRequest {
    description: string;
    quantity: number;
    unitPrice: number;
}

export interface UpdateInvoiceRequest extends CreateInvoiceRequest {
    id: number;
}

// Query Keys
export const invoiceKeys = {
    all: ['invoices'] as const,
    lists: () => [...invoiceKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...invoiceKeys.lists(), filters] as const,
    details: () => [...invoiceKeys.all, 'detail'] as const,
    detail: (id: number) => [...invoiceKeys.details(), id] as const,
};

// Hooks
export function useInvoices() {
    return useQuery({
        queryKey: invoiceKeys.lists(),
        queryFn: async () => {
            const res = await api.get('/Invoices');
            // Handle both paginated { data: [] } and plain array []
            return Array.isArray(res.data) ? res.data : (res.data.data || []) as InvoiceListDto[];
        },
    });
}

export function useInvoice(id: number) {
    return useQuery({
        queryKey: invoiceKeys.detail(id),
        queryFn: async () => {
            const res = await api.get(`/Invoices/${id}`);
            return res.data as Invoice;
        },
        enabled: !!id,
    });
}

export function useCreateInvoice() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateInvoiceRequest) => {
            const res = await api.post('/Invoices', data);
            return res.data as Invoice;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
        },
    });
}

export function useUpdateInvoice() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: UpdateInvoiceRequest) => {
            const res = await api.put(`/Invoices/${data.id}`, data);
            return res.data as Invoice;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
        },
    });
}

export function useDeleteInvoice() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/Invoices/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
        },
    });
}

export function useDownloadInvoicePdf() {
    return useMutation({
        mutationFn: async ({ id, number }: { id: number; number: string | number }) => {
            const res = await api.get(`/Invoices/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Facture_${number}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        },
    });
}

export function useLockInvoice() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.post(`/Invoices/${id}/lock`);
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
        },
    });
}

export function useMarkInvoiceTreated() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.post(`/Invoices/${id}/treated`);
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
        },
    });
}
