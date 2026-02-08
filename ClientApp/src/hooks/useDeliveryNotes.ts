import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// Types
export interface DeliveryNote {
    id: number;
    number: number;
    date: string;
    clientId: number;
    clientName: string;
    items?: DeliveryNoteItem[];
}

export interface DeliveryNoteItem {
    id: number;
    description: string;
    quantity: number;
}

export interface DeliveryNoteListDto {
    id: number;
    number: number;
    date: string;
    clientName: string;
}

export interface CreateDeliveryNoteRequest {
    clientId: number;
    date: string;
    items: CreateDeliveryNoteItemRequest[];
}

export interface CreateDeliveryNoteItemRequest {
    description: string;
    quantity: number;
}

export interface UpdateDeliveryNoteRequest extends CreateDeliveryNoteRequest {
    id: number;
}

// Query Keys
export const deliveryNoteKeys = {
    all: ['deliveryNotes'] as const,
    lists: () => [...deliveryNoteKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...deliveryNoteKeys.lists(), filters] as const,
    details: () => [...deliveryNoteKeys.all, 'detail'] as const,
    detail: (id: number) => [...deliveryNoteKeys.details(), id] as const,
};

// Hooks
export function useDeliveryNotes() {
    return useQuery({
        queryKey: deliveryNoteKeys.lists(),
        queryFn: async () => {
            const res = await api.get('/DeliveryNotes');
            return Array.isArray(res.data) ? res.data : (res.data.data || []) as DeliveryNoteListDto[];
        },
    });
}

export function useDeliveryNote(id: number) {
    return useQuery({
        queryKey: deliveryNoteKeys.detail(id),
        queryFn: async () => {
            const res = await api.get(`/DeliveryNotes/${id}`);
            return res.data as DeliveryNote;
        },
        enabled: !!id,
    });
}

export function useCreateDeliveryNote() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateDeliveryNoteRequest) => {
            const res = await api.post('/DeliveryNotes', data);
            return res.data as DeliveryNote;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: deliveryNoteKeys.all });
        },
    });
}

export function useUpdateDeliveryNote() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: UpdateDeliveryNoteRequest) => {
            const res = await api.put(`/DeliveryNotes/${data.id}`, data);
            return res.data as DeliveryNote;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: deliveryNoteKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: deliveryNoteKeys.lists() });
        },
    });
}

export function useDeleteDeliveryNote() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/DeliveryNotes/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: deliveryNoteKeys.all });
        },
    });
}

export function useDownloadDeliveryNotePdf() {
    return useMutation({
        mutationFn: async ({ id, number }: { id: number; number: string | number }) => {
            const res = await api.get(`/DeliveryNotes/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `BL_${number}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        },
    });
}
