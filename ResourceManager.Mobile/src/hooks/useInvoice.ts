import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../api';
import type { Invoice, InvoiceDetail, RecordPaymentRequest, SaveInvoiceRequest } from '../api';

export function useInvoices(page = 1, size = 20) {
  return useQuery({
    queryKey: ['invoices', page, size],
    queryFn: () => invoicesApi.list(page, size, true),
  });
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.getById(id),
    enabled: !!id,
  });
}

export function useArchivedInvoices(year?: number, page = 1, size = 20) {
  return useQuery({
    queryKey: ['archived-invoices', year, page, size],
    queryFn: () => invoicesApi.getArchived(year, page, size),
    enabled: !!year,
  });
}

export function useAvailableYears() {
  return useQuery({
    queryKey: ['archive-years'],
    queryFn: () => invoicesApi.getAvailableYears(),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveInvoiceRequest) => invoicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveInvoiceRequest }) => invoicesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invoicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: number; data: RecordPaymentRequest }) =>
      invoicesApi.recordPayment(invoiceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useArchiveInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invoicesApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['archived-invoices'] });
    },
  });
}

export function useSendInvoiceEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: number; data: any }) =>
      invoicesApi.sendEmail(invoiceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
    },
  });
}

export function useInvoiceFilters() {
  const [filter, setFilter] = useState<{
    search: string;
    status?: string;
    year?: number;
  }>({
    search: '',
  });

  const clearFilter = () => {
    setFilter({ search: '' });
  };

  const applySearch = (text: string) => {
    setFilter({ ...filter, search: text });
  };

  const filterInvoices = (invoices: Invoice[]) => {
    if (!filter.search && !filter.status && !filter.year) {
      return invoices;
    }

    return invoices.filter((invoice) => {
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const matchesNumber = invoice.number?.toLowerCase().includes(searchLower);
        const matchesClient = invoice.clientName?.toLowerCase().includes(searchLower);
        if (!matchesNumber && !matchesClient) return false;
      }

      if (filter.status && invoice.status !== filter.status) {
        return false;
      }

      return true;
    });
  };

  return {
    filter,
    setFilter,
    clearFilter,
    applySearch,
    filterInvoices,
  };
}
