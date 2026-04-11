import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi } from '../api/quotes';
import { deliveryNotesApi } from '../api/deliveryNotes';
import type { SaveQuoteRequest, SaveDeliveryNoteRequest } from '../api';

export function useQuotes(page = 1, size = 20) {
  return useQuery({
    queryKey: ['quotes', page, size],
    queryFn: () => quotesApi.list(page, size),
  });
}

export function useQuoteDetail(id: number) {
  return useQuery({
    queryKey: ['quote', id],
    queryFn: () => quotesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveQuoteRequest) => quotesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveQuoteRequest }) => quotesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote'] });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => quotesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export function useConvertQuoteToInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => quotesApi.convertToInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useDeliveryNotes(page = 1, size = 20) {
  return useQuery({
    queryKey: ['deliveryNotes', page, size],
    queryFn: () => deliveryNotesApi.list(page, size),
  });
}

export function useDeliveryNoteDetail(id: number) {
  return useQuery({
    queryKey: ['deliveryNote', id],
    queryFn: () => deliveryNotesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateDeliveryNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveDeliveryNoteRequest) => deliveryNotesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryNotes'] });
    },
  });
}

export function useUpdateDeliveryNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveDeliveryNoteRequest }) => deliveryNotesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryNotes'] });
      queryClient.invalidateQueries({ queryKey: ['deliveryNote'] });
    },
  });
}

export function useDeleteDeliveryNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deliveryNotesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryNotes'] });
    },
  });
}
