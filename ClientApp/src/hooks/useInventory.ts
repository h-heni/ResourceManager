import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface StockLevel {
  productServiceId: number;
  productName: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  type: string;
  currentStock: number;
  reorderPoint: number | null;
  minimumStock: number | null;
  maximumStock: number | null;
  unitOfMeasure: string | null;
  defaultUnitPrice: number;
  costPrice: number | null;
  stockValue: number;
  warehouseName: string | null;
  warehouseId: number | null;
  supplierName: string | null;
  supplierId: number | null;
  stockStatus: string;
}

export interface PaginatedStockLevels {
  data: StockLevel[];
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
}

export interface StockMovement {
  id: number;
  productServiceId: number;
  productName: string;
  sku: string | null;
  movementType: string;
  quantity: number;
  unitCost: number | null;
  stockAfter: number;
  referenceType: string | null;
  referenceId: number | null;
  referenceNumber: string | null;
  date: string;
  notes: string | null;
  warehouseName: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface StockAlert {
  id: number;
  productServiceId: number;
  productName: string;
  sku: string | null;
  alertType: string;
  threshold: number;
  currentQuantity: number;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

export interface PurchaseOrderList {
  id: number;
  number: string;
  date: string;
  expectedDeliveryDate: string | null;
  status: string;
  supplierName: string | null;
  supplierId: number;
  totalAmount: number | null;
  currency: string | null;
  itemCount: number;
  createdAt: string;
  supplierInvoiceId: number | null;
  supplierInvoiceNumber: string | null;
}

export interface PurchaseOrderDetail {
  id: number;
  number: string;
  date: string;
  expectedDeliveryDate: string | null;
  status: string;
  supplierName: string | null;
  supplierId: number;
  totalAmount: number | null;
  subTotal: number | null;
  taxAmount: number | null;
  currency: string | null;
  itemCount: number;
  createdAt: string;
  notes: string | null;
  supplierInvoiceId: number | null;
  supplierInvoiceNumber: string | null;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: number;
  productServiceId: number;
  productName: string;
  sku: string | null;
  description: string;
  quantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  taxRate: number | null;
  totalHT: number;
}

export interface InventoryValuationReport {
  totalStockValue: number;
  totalRetailValue: number;
  totalProducts: number;
  trackedProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  overstockCount: number;
  items: StockLevel[];
}

export interface InventoryReport {
  totalProducts: number;
  totalStockValue: number;
  totalRetailValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  unresolvedAlerts: number;
  unreadAlerts: number;
  pendingPurchaseOrders: number;
  recentMovements: { type: string; count: number; totalQty: number }[];
}

// ═══════════════════════════════════════════════════════════════
// QUERY KEYS
// ═══════════════════════════════════════════════════════════════

export interface ProductServiceOption {
  id: number;
  name: string;
  defaultUnitPrice: number;
  type: string;
  category?: string;
  isStockTracked?: boolean;
}

export interface SupplierOption {
  id: number;
  name: string;
  matriculeFiscal?: string;
}

export const inventoryKeys = {
  all: ['inventory'] as const,
  stockLevels: () => [...inventoryKeys.all, 'stock-levels'] as const,
  movements: (params?: Record<string, unknown>) => [...inventoryKeys.all, 'movements', params] as const,
  alerts: () => [...inventoryKeys.all, 'alerts'] as const,
  purchaseOrders: () => [...inventoryKeys.all, 'purchase-orders'] as const,
  purchaseOrder: (id: number) => [...inventoryKeys.all, 'purchase-orders', id] as const,
  valuation: () => [...inventoryKeys.all, 'valuation'] as const,
  turnover: () => [...inventoryKeys.all, 'turnover'] as const,
  summary: () => [...inventoryKeys.all, 'summary'] as const,
  products: () => ['products-lookup'] as const,
  suppliers: () => ['suppliers-lookup'] as const,
};

// ═══════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════

export function useStockLevels(params?: { search?: string; status?: string; page?: number; size?: number }) {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.size) query.set('size', String(params.size));
  const qs = query.toString();

  return useQuery<PaginatedStockLevels>({
    queryKey: [...inventoryKeys.stockLevels(), params],
    queryFn: async () => {
      const res = await api.get(`/Inventory/stock-levels${qs ? `?${qs}` : ''}`);
      return res.data;
    },
  });
}

export function useStockMovements(params?: { productId?: number; type?: string; from?: string; to?: string; page?: number; size?: number }) {
  const query = new URLSearchParams();
  if (params?.productId) query.set('productServiceId', String(params.productId));
  if (params?.type) query.set('movementType', params.type);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.page) query.set('page', String(params.page));
  if (params?.size) query.set('size', String(params.size));
  const qs = query.toString();

  return useQuery<{ data: StockMovement[]; totalCount: number; totalPages: number }>({
    queryKey: inventoryKeys.movements(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await api.get(`/Inventory/movements${qs ? `?${qs}` : ''}`);
      return res.data;
    },
  });
}

export function useStockAlerts() {
  return useQuery<StockAlert[]>({
    queryKey: inventoryKeys.alerts(),
    queryFn: async () => {
      const res = await api.get('/Inventory/alerts');
      return res.data;
    },
  });
}

export function usePurchaseOrders(params?: { status?: string; page?: number; size?: number }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.size) query.set('size', String(params.size));
  const qs = query.toString();

  return useQuery<{ data: PurchaseOrderList[]; totalCount: number; totalPages: number }>({
    queryKey: [...inventoryKeys.purchaseOrders(), params],
    queryFn: async () => {
      const res = await api.get(`/Inventory/purchase-orders${qs ? `?${qs}` : ''}`);
      return res.data;
    },
  });
}

export function usePurchaseOrder(id: number | null) {
  return useQuery<PurchaseOrderDetail>({
    queryKey: inventoryKeys.purchaseOrder(id ?? 0),
    queryFn: async () => {
      if (id == null) throw new Error('No purchase order ID');
      const res = await api.get(`/Inventory/purchase-orders/${id}`);
      return res.data;
    },
    enabled: id != null,
  });
}

export function useInventoryValuation() {
  return useQuery<InventoryValuationReport>({
    queryKey: inventoryKeys.valuation(),
    queryFn: async () => {
      const res = await api.get('/Inventory/reports/valuation');
      return res.data;
    },
  });
}

export function useInventoryReport() {
  return useQuery<InventoryReport>({
    queryKey: inventoryKeys.summary(),
    queryFn: async () => {
      const res = await api.get('/Inventory/reports/summary');
      return res.data;
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// LOOKUP QUERIES (for dropdowns)
// ═══════════════════════════════════════════════════════════════

/** Fetch all products/services for inventory dropdown selectors */
export function useProductServiceOptions() {
  return useQuery<ProductServiceOption[]>({
    queryKey: inventoryKeys.products(),
    queryFn: async () => {
      const res = await api.get('/ProductServices?page=1&size=500');
      return (res.data.data || res.data.Data || []).map((p: Record<string, unknown>) => ({
        id: p.id ?? p.Id,
        name: p.name ?? p.Name,
        defaultUnitPrice: Number(p.defaultUnitPrice ?? p.DefaultUnitPrice ?? 0),
        type: String(p.type ?? p.Type ?? ''),
        category: (p.category ?? p.Category) as string | undefined,
        isStockTracked: Boolean(p.isStockTracked ?? p.IsStockTracked ?? false),
      }));
    },
    staleTime: 30 * 1000, // cache 30s — refreshes quickly after cross-page mutations
  });
}

/** Fetch all suppliers for dropdown selectors */
export function useSupplierOptions() {
  return useQuery<SupplierOption[]>({
    queryKey: inventoryKeys.suppliers(),
    queryFn: async () => {
      const res = await api.get('/Suppliers?page=1&size=500');
      return (res.data.data || []).map((s: Record<string, unknown>) => ({
        id: s.id,
        name: s.name,
        matriculeFiscal: s.matriculeFiscal,
      }));
    },
    staleTime: 30 * 1000, // cache 30s — refreshes quickly after cross-page mutations
  });
}

// ═══════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { productServiceId: number; newQuantity: number; reason: string }) => {
      const res = await api.post('/Inventory/adjust', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useTransferStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { productServiceId: number; fromWarehouseId: number; toWarehouseId: number; quantity: number; notes?: string }) => {
      const res = await api.post('/Inventory/transfer', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useRecordMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { productServiceId: number; movementType: string; quantity: number; unitCost?: number; notes?: string; warehouseId?: number }) => {
      const res = await api.post('/Inventory/movements', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      supplierId: number;
      expectedDeliveryDate?: string;
      notes?: string;
      currency?: string;
      currencySymbol?: string;
      pdfLanguage?: string;
      items: { productServiceId: number; quantity: number; unitPrice: number }[];
    }) => {
      const res = await api.post('/Inventory/purchase-orders', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders() });
    },
  });
}

export function useUpdatePurchaseOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await api.put(`/Inventory/purchase-orders/${id}/status`, JSON.stringify(status), { headers: { 'Content-Type': 'application/json' } });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useReceivePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, items }: { id: number; items: { purchaseOrderItemId: number; receivedQuantity: number }[] }) => {
      const res = await api.post(`/Inventory/purchase-orders/${id}/receive`, { items });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useDeletePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/Inventory/purchase-orders/${id}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders() });
    },
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.put(`/Inventory/alerts/${id}`, { isResolved: true });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.alerts() });
    },
  });
}
