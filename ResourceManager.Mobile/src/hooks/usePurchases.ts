import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suppliersApi, type SaveSupplierRequest } from '../api/suppliers';
import { expensesApi, type SaveExpenseRequest } from '../api/expenses';

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersApi.list(),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveSupplierRequest) => suppliersApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveSupplierRequest }) => suppliersApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => suppliersApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); },
  });
}

export function useExpenses(page = 1, size = 20, year?: number) {
  return useQuery({
    queryKey: ['expenses', page, size, year],
    queryFn: () => expensesApi.list(page, size, year),
  });
}

export function useExpenseSummary(year?: number) {
  return useQuery({
    queryKey: ['expense-summary', year],
    queryFn: () => expensesApi.getSummary(year),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveExpenseRequest) => expensesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveExpenseRequest }) => expensesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => expensesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
    },
  });
}
