import { apiClient } from './auth';
import { DEFAULT_PAGE_SIZE } from './config';

export interface StockLevel {
  id: number;
  productName: string;
  productId: number;
  warehouseName: string;
  currentQuantity: number;
  reorderPoint: number;
  status: string;
}

export interface StockAlert {
  id: number;
  productName: string;
  productId: number;
  currentQuantity: number;
  reorderPoint: number;
  severity: string;
  warehouseName: string;
}

export interface StockMovement {
  id: number;
  productName: string;
  movementType: string;
  quantity: number;
  reason?: string;
  date: string;
  userName?: string;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierName: string;
  supplierId: number;
  status: string;
  totalAmount: number;
  expectedDeliveryDate?: string;
  createdAt: string;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface InventoryValuation {
  totalStockValue: number;
  totalRetailValue: number;
  totalProducts: number;
  trackedProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  overstockCount: number;
  items: {
    id: number;
    productName: string;
    currentStock: number;
    defaultUnitPrice: number;
    stockValue: number;
    stockStatus: string;
  }[];
}

export interface StockTurnoverItem {
  productServiceId: number;
  productName: string;
  sku: string;
  totalSold: number;
  averageStock: number;
  turnoverRate: number;
  daysSinceLastMovement: number;
  isDeadStock: boolean;
}

export interface InventoryReport {
  topProducts: { productName: string; totalUsed: number }[];
  totalMovements: number;
}

export interface AdjustStockRequest {
  productId: number;
  quantity: number;
  reason: string;
}

export interface TransferStockRequest {
  productId: number;
  fromWarehouse: string;
  toWarehouse: string;
  quantity: number;
}

export interface CreatePurchaseOrderRequest {
  supplierId: number;
  expectedDeliveryDate?: string;
  items: { productId: number; quantity: number; unitPrice: number }[];
}

// Normalize backend StockLevelDto → mobile StockLevel
function normalizeStockLevel(p: any): StockLevel {
  return {
    id: p.id ?? p.productServiceId ?? p.ProductServiceId ?? 0,
    productName: p.productName ?? p.ProductName ?? '',
    productId: p.productServiceId ?? p.ProductServiceId ?? p.productId ?? 0,
    warehouseName: p.warehouseName ?? p.WarehouseName ?? '',
    currentQuantity: p.currentStock ?? p.CurrentStock ?? p.currentQuantity ?? 0,
    reorderPoint: p.reorderPoint ?? p.ReorderPoint ?? 0,
    status: p.stockStatus ?? p.StockStatus ?? p.status ?? 'InStock',
  };
}

// Normalize backend StockAlertDto → mobile StockAlert
function normalizeStockAlert(a: any): StockAlert {
  return {
    id: a.id ?? a.Id ?? 0,
    productName: a.productName ?? a.ProductName ?? '',
    productId: a.productServiceId ?? a.ProductServiceId ?? a.productId ?? 0,
    currentQuantity: a.currentQuantity ?? a.CurrentQuantity ?? 0,
    reorderPoint: a.threshold ?? a.Threshold ?? a.reorderPoint ?? 0,
    severity: a.alertType ?? a.AlertType ?? a.severity ?? '',
    warehouseName: a.warehouseName ?? a.WarehouseName ?? '',
  };
}

export const inventoryApi = {
  getStockLevels: async (page = 1, size = DEFAULT_PAGE_SIZE, search?: string, status?: string): Promise<{ items: StockLevel[]; totalCount: number }> => {
    const response = await apiClient.get('/Inventory/stock-levels', { params: { page, size, search, status } });
    const d = response.data;
    if (Array.isArray(d)) {
      const items = d.map((p: any) => normalizeStockLevel(p));
      return { items, totalCount: items.length };
    }
    if (d && (d.data || d.Data)) {
      const raw = d.data ?? d.Data ?? [];
      const items = raw.map((p: any) => normalizeStockLevel(p));
      return { items, totalCount: d.totalCount ?? d.TotalCount ?? items.length };
    }
    return d;
  },

  getStockAlerts: async (): Promise<StockAlert[]> => {
    const response = await apiClient.get('/Inventory/alerts');
    const d = response.data;
    if (Array.isArray(d)) {
      return d.map((a: any) => normalizeStockAlert(a));
    }
    return d;
  },

  getMovements: async (productId?: number, type?: string, page = 1, size = DEFAULT_PAGE_SIZE): Promise<{ items: StockMovement[]; totalCount: number }> => {
    const response = await apiClient.get('/Inventory/movements', { params: { productId, type, page, size } });
    const d = response.data;
    if (Array.isArray(d)) {
      return { items: d, totalCount: d.length };
    }
    if (d && (d.data || d.Data)) {
      const raw = d.data ?? d.Data ?? [];
      return { items: raw, totalCount: d.totalCount ?? d.TotalCount ?? raw.length };
    }
    return d;
  },

  adjustStock: async (data: AdjustStockRequest): Promise<void> => {
    await apiClient.post('/Inventory/adjust', data);
  },

  transferStock: async (data: TransferStockRequest): Promise<void> => {
    await apiClient.post('/Inventory/transfer', data);
  },

  getPurchaseOrders: async (status?: string, page = 1, size = DEFAULT_PAGE_SIZE): Promise<{ items: PurchaseOrder[]; totalCount: number }> => {
    const response = await apiClient.get('/Inventory/purchase-orders', { params: { status, page, size } });
    const d = response.data;
    if (Array.isArray(d)) {
      return { items: d, totalCount: d.length };
    }
    if (d && (d.data || d.Data)) {
      const raw = d.data ?? d.Data ?? [];
      return { items: raw, totalCount: d.totalCount ?? d.TotalCount ?? raw.length };
    }
    return d;
  },

  getPurchaseOrder: async (id: number): Promise<PurchaseOrder> => {
    const response = await apiClient.get(`/Inventory/purchase-orders/${id}`);
    return response.data;
  },

  createPurchaseOrder: async (data: CreatePurchaseOrderRequest): Promise<PurchaseOrder> => {
    const response = await apiClient.post('/Inventory/purchase-orders', data);
    return response.data;
  },

  updatePurchaseOrderStatus: async (id: number, status: string): Promise<void> => {
    await apiClient.put(`/Inventory/purchase-orders/${id}/status`, { status });
  },

  receivePurchaseOrder: async (id: number): Promise<void> => {
    await apiClient.post(`/Inventory/purchase-orders/${id}/receive`);
  },

  deletePurchaseOrder: async (id: number): Promise<void> => {
    await apiClient.delete(`/Inventory/purchase-orders/${id}`);
  },

  getValuationReport: async (): Promise<InventoryValuation> => {
    const response = await apiClient.get('/Inventory/reports/valuation');
    const d = response.data;
    return {
      totalStockValue: d?.TotalStockValue ?? d?.totalStockValue ?? 0,
      totalRetailValue: d?.TotalRetailValue ?? d?.totalRetailValue ?? 0,
      totalProducts: d?.TotalProducts ?? d?.totalProducts ?? 0,
      trackedProducts: d?.TrackedProducts ?? d?.trackedProducts ?? 0,
      lowStockCount: d?.LowStockCount ?? d?.lowStockCount ?? 0,
      outOfStockCount: d?.OutOfStockCount ?? d?.outOfStockCount ?? 0,
      overstockCount: d?.OverstockCount ?? d?.overstockCount ?? 0,
      items: (d?.Items ?? d?.items ?? []).map((i: any) => ({
        id: i.Id ?? i.id ?? 0,
        productName: i.ProductName ?? i.productName ?? '',
        currentStock: i.CurrentStock ?? i.currentStock ?? 0,
        defaultUnitPrice: i.DefaultUnitPrice ?? i.defaultUnitPrice ?? 0,
        stockValue: i.StockValue ?? i.stockValue ?? 0,
        stockStatus: i.StockStatus ?? i.stockStatus ?? '',
      })),
    };
  },

  getUsageReport: async (): Promise<StockTurnoverItem[]> => {
    const response = await apiClient.get('/Inventory/reports/turnover');
    const d = response.data;
    const arr = Array.isArray(d) ? d : (d?.data ?? d?.Data ?? []);
    return arr.map((i: any) => ({
      productServiceId: i.ProductServiceId ?? i.productServiceId ?? 0,
      productName: i.ProductName ?? i.productName ?? '',
      sku: i.SKU ?? i.sku ?? '',
      totalSold: i.TotalSold ?? i.totalSold ?? 0,
      averageStock: i.AverageStock ?? i.averageStock ?? 0,
      turnoverRate: i.TurnoverRate ?? i.turnoverRate ?? 0,
      daysSinceLastMovement: i.DaysSinceLastMovement ?? i.daysSinceLastMovement ?? 0,
      isDeadStock: i.IsDeadStock ?? i.isDeadStock ?? false,
    }));
  },

  resolveAlert: async (id: number): Promise<void> => {
    await apiClient.post(`/Inventory/alerts/${id}/resolve`);
  },
};
