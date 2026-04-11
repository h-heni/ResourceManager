import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, type AdjustStockRequest, type TransferStockRequest, type CreatePurchaseOrderRequest } from '../api/inventory';

export function usePurchaseOrders(status?: string) {
  return useQuery({
    queryKey: ['purchase-orders', status],
    queryFn: () => inventoryApi.getPurchaseOrders(status),
  });
}

export function usePurchaseOrder(id: number) {
  return useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => inventoryApi.getPurchaseOrder(id),
    enabled: !!id,
  });
}

export function useStockMovements(productId?: number, type?: string) {
  return useQuery({
    queryKey: ['stock-movements', productId, type],
    queryFn: () => inventoryApi.getMovements(productId, type),
  });
}

export function useInventoryValuation() {
  return useQuery({
    queryKey: ['inventory-valuation'],
    queryFn: () => inventoryApi.getValuationReport(),
  });
}

export function useInventoryReport() {
  return useQuery({
    queryKey: ['inventory-report'],
    queryFn: () => inventoryApi.getUsageReport(),
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdjustStockRequest) => inventoryApi.adjustStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });
}

export function useTransferStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TransferStockRequest) => inventoryApi.transferStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePurchaseOrderRequest) => inventoryApi.createPurchaseOrder(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); },
  });
}

export function useUpdatePurchaseOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => inventoryApi.updatePurchaseOrderStatus(id, status),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); },
  });
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => inventoryApi.receivePurchaseOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
    },
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => inventoryApi.deletePurchaseOrder(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => inventoryApi.resolveAlert(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['stock-alerts'] }); },
  });
}
