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
  totalValue: number;
  items: { productName: string; quantity: number; unitPrice: number; totalValue: number }[];
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

export const inventoryApi = {
  getStockLevels: async (page = 1, size = DEFAULT_PAGE_SIZE, search?: string, status?: string): Promise<{ items: StockLevel[]; totalCount: number }> => {
    const response = await apiClient.get('/Inventory/stock-levels', { params: { page, size, search, status } });
    if (Array.isArray(response.data)) {
      return { items: response.data, totalCount: response.data.length };
    }
    return response.data;
  },

  getStockAlerts: async (): Promise<StockAlert[]> => {
    const response = await apiClient.get('/Inventory/stock-alerts');
    return response.data;
  },

  getMovements: async (productId?: number, type?: string, page = 1, size = DEFAULT_PAGE_SIZE): Promise<{ items: StockMovement[]; totalCount: number }> => {
    const response = await apiClient.get('/Inventory/movements', { params: { productId, type, page, size } });
    if (Array.isArray(response.data)) {
      return { items: response.data, totalCount: response.data.length };
    }
    return response.data;
  },

  adjustStock: async (data: AdjustStockRequest): Promise<void> => {
    await apiClient.post('/Inventory/adjust', data);
  },

  transferStock: async (data: TransferStockRequest): Promise<void> => {
    await apiClient.post('/Inventory/transfer', data);
  },

  getPurchaseOrders: async (status?: string, page = 1, size = DEFAULT_PAGE_SIZE): Promise<{ items: PurchaseOrder[]; totalCount: number }> => {
    const response = await apiClient.get('/Inventory/purchase-orders', { params: { status, page, size } });
    if (Array.isArray(response.data)) {
      return { items: response.data, totalCount: response.data.length };
    }
    return response.data;
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
    const response = await apiClient.get('/Inventory/valuation-report');
    return response.data;
  },

  getUsageReport: async (): Promise<InventoryReport> => {
    const response = await apiClient.get('/Inventory/report');
    return response.data;
  },

  resolveAlert: async (id: number): Promise<void> => {
    await apiClient.post(`/Inventory/alerts/${id}/resolve`);
  },
};
